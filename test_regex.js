const msg = "Could not find the 'approvalStatus' column of 'contracts' in the schema";
const colMatch = msg.match(/Could not find the '([^']+)' column/) || msg.match(/column "?([^"\s]+)"? of relation/);
console.log(colMatch[1]);
