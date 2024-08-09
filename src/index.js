import {hexToString, stringToHex} from "viem";

const { ethers } = require("ethers");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

let users = []
let total_users = 0


  function add_or_update_user(cryptopair, amount, cryptoprice, address){
    
    const userIndex = users.findIndex(user => user.address === address)
    const date = Date.now();

    const newEntry = {
      cryptopair : cryptopair,
      amount : amount,
      date : date,
      cryptoprice: cryptoprice,
      address : address
    };

    if (userIndex !== -1){
      users[userIndex].amount += amount;
      users[userIndex].data = date;
      
      console.log(`Updated user of address ${address} for ${cryptopair}.`)
    }else {
      users.push(newEntry);
      console.log(`Added new user of address ${address}.`);
      total_users += 1;
    }
  }


async function handle_advance(data) {
  console.log("Received Inputs : " + JSON.stringify(data));

  //const { cryptopair, amount, date, cryptoprice, address} = data;
  const metadata = data["metadata"]
  const sender = getAddress(metadata.msg_sender)
  const date = Date.now()
  const cryptopair = data["cryptopair"]
  const amount = data["amount"];


  try{

  if (!cryptopair || !amount || !date || !cryptoprice ){
    
    throw("All fields are required")
    process.exit(1)
  
  }
    let input = data.payload
    let str = Buffer.from(input.substr(2), "hex").toString("utf8");
    let json = JSON.parse(str);

    if (json.method === "add_user"){
    let notice = add_or_update_user(json.cryptopair, BigInt(json.amount), json.date, json.cryptoprice, json.sender);
      console.log(`the user details are ${notice}`)
    await fetch(rollup_server + "notice", {
      method : "POST",
      headers: {
        "Content-Type" : "application/json"
      },
      body : JSON.stringify({ payload: notice.payload})
    })
  }else if (json.method === "retrieve_user"){
    
  }

  }catch (err){
    const error = viem.stringToHex(`Error:${e}`)

    await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payload: error
      }),
    });
    return reject

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

  // if (users.includes(!user)){
  //   let new_user = user_details(json.CryptoPair, json.Amount, json.Date, json.CryptoPrice, json.address);
    
  //   let notice = await fetch( rollup_server + "/notice", {
  //     method : "POST",
  //     headers : {
  //       "Content-Type" : "application/json", 
  //     },
  //     body: JSON.stringify({payload : notice.payload })
  //   })
  // }
  //   return "accept";
  

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
