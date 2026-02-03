const { execSync } = require('child_process');
const fs = require('fs');

function ensurePackage(pkg) {
  try {
    require.resolve(pkg);
    console.log(`${pkg} is installed.`);
    return true;
  } catch (e) {
    console.log(`${pkg} is NOT installed. Attempting to install...`);
    try {
      execSync(`npm install ${pkg} --no-audit --no-fund --no-progress`, { stdio: 'inherit' });
      console.log(`${pkg} installed successfully.`);
      return true;
    } catch (ie) {
      console.error(`Failed to install ${pkg}:`, ie.message || ie);
      return false;
    }
  }
}

(async () => {
  console.log('Running backend postinstall deploy checks...');
  const ok = ensurePackage('exceljs');
  if (!ok) {
    console.warn('exceljs is required for XLSX export. Please install manually if automatic install failed.');
  }

  // If running in production, attempt to restart pm2 process
  try {
    const env = process.env.NODE_ENV || '';
    if (env === 'production') {
      console.log('Detected production environment. Attempting to restart pm2 process `ubnd-backend`...');
      try {
        execSync('pm2 restart ubnd-backend', { stdio: 'inherit' });
        console.log('pm2 restart issued.');
      } catch (pm2err) {
        console.warn('pm2 restart failed or pm2 not available. Please restart the backend process manually.');
      }
    } else {
      console.log('NODE_ENV != production, skipping pm2 restart.');
    }
  } catch (err) {
    console.error('Postinstall deploy script error:', err.message || err);
  }
})();
