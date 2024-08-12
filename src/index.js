// NOTE: SOME OF THE LOGIC FROM THIS BACKEND WILL BE RE-WRITTEN ON THE SMARTCONTRACT SIDE AND REMOVED HERE
// THIS IS TO ALLOW SEEMLESS INTERACTION FROM THE SMART CONTRACT TO THE BACKEND.



import {hexToString, stringToHex} from "viem";

const { ethers } = require("ethers");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

let users = []
let total_users = 0


  function add_or_update_user(cryptopair, amount, cryptoprice, sender){
    
    const userIndex = users.findIndex(user => user.sender === sender)
    const date = Date.now();

    const newEntry = {
      cryptopair : cryptopair,
      amount : amount,
      date : date,
      cryptoprice: cryptoprice,
      sender : sender
    };

    if (userIndex !== -1){
      users[userIndex].amount += amount;
      users[userIndex].date = date;
      
      console.log(`Updated user of address ${sender} for ${cryptopair}.`)

      return {success: true, payload: newEntry}

    }else {
      users.push(newEntry);
      console.log(`Added new user of address ${sender} with cryptopair ${cryptopair}`);
      total_users += 1;

      return {success: true, payload: newEntry}
    }
  }

    function retrieve_user(sender){
      const user = users.find(user => user.sender === sender)
      if (user){
        return user
      }else{
        return null;
      }
    }

    function remove_user(sender){
      const userIndex = users.findIndex(user => user.sender === sender);
      if (userIndex !== -1){
        users.splice(userIndex, 1)
        total_users += 1
        console.log(`Removed user is ${sender}`)
      }  

    }


    //////  HANDLE ADVANCE
async function handle_advance(data) {
  console.log("Received Inputs : " + JSON.stringify(data));

  //const { cryptopair, amount, date, cryptoprice, address} = data;
  const metadata = data["metadata"]
  const inputPayload = data["payload"]
  const payload_str = hexToString(inputPayload)

  if(!metadata || !metadata["msg_sender"]){

    console.error("Missing metadata or the sender information")
    return "reject";
  }

  const sender = metadata["msg_sender"]
  if(!sender){
    console.error("Sender address missing")
    return "reject"
  }
  
  const date = Date.now()
  const cryptopair = payload_str["cryptopair"]
  const amount = payload_str["amount"]
  const cryptoprice = payload_str["cryptoprice"]

  let input = data.payload
  let str = Buffer.from(input.substr(2), "hex").toString("utf8");

  let json 
  try{
    json = JSON.parse(str)
  }catch(parseError){
    console.error("Failed to parse JSON", parseError)

    return "reject"
  }

  try{

 if(json.method === "add_user"){
  //  HANDLE NOTICE ----> USER UPDATE
    await fetch(rollup_server + "/notice", {
      method : "POST",
      headers: {
        "Content-Type" : "application/json"
      },
      body : JSON.stringify({ payload: inputPayload})
    })

    return "accept"


    //HANDLE REPORT ----> USER RETRIVAL
  }else if (json.method === "retrieve_user"){
    // {"method" : "retrieve_user", "sender" : "" } 
    const user = retrieve_user(sender);

    if (user){
      const hexPayload = '0x' + Buffer.from(JSON.stringify(user), 'utf-8').toString('hex')
    await fetch(rollup_server + "/report", {
      method : "POST",
      headers: {
        "Content-Type" : "application/json"
      },
      body: JSON.stringify({payload: hexPayload})
     // body: JSON.stringify({payload: stringToHex(JSON.stringify(user))})
    })
    return "accept"

  }else {
    const error = `User with address ${json.sender} not found`

    await fetch (rollup_server + "/report", {
      method : "POST",
      headers : {
        "Content-Type" : "application/json"
      },
      body: JSON.stringify({payload : error})
    })
    return "reject"
  }
    
  }

  }catch (e){
    const error = stringToHex(`Error:${e}`)

    await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payload: error
      }),
    });
    return "reject";

  }



}

async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));

  const payload = data["payload"]
  const route = hexToString(payload)

  let responseObject = {}

  if (route === "all_users"){
    responseObject = JSON.stringify(total_users);
  }else if (route === "list_users"){
    responseObject = JSON.stringify(users);
  }else {
    responseObject = "No implementation found";
  }

  const report_req = await fetch(rollup_server + "/report", {
    method : "POST",
    headers: {
      "Content-Type" : "application/json"
    },
    body : JSON.stringify({ payload : stringToHex(responseObject)})
  })
  

  return "accept";
}

var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "accept" }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);
    }
  }
})();
