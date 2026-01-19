const bcrypt = require('bcryptjs');
(async ()=>{
  const pw='TestExport123!';
  const hash='$2a$10$Llv4fx1tGfIukIH957af8.8wCiiert2dsqpj97RoiKru48Q4opUHi';
  const ok = await bcrypt.compare(pw, hash);
  console.log('bcrypt compare result:', ok);
})();
