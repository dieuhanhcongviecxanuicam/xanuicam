const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT_TMP_UI || 4001;

app.use('/', express.static(path.join(__dirname, '..', 'tmp_ui')));

app.listen(port, () => {
  console.log('tmp ui server listening on', port);
});
