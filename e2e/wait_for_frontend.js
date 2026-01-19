const http = require('http');
const maxMs = Number(process.argv[2]||30000);
const start = Date.now();
function check(){
  const req = http.request({host:'localhost',port:3000,method:'HEAD',path:'/'}, res=>{
    console.log('UP', res.statusCode);
    process.exit(0);
  });
  req.on('error', ()=>{
    if (Date.now()-start > maxMs) { console.error('TIMEOUT'); process.exit(2); }
    setTimeout(check, 1000);
  });
  req.end();
}
check();
