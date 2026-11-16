// MAYAACC dev build: skip Windows code signing (no certificate, no Wine on Linux).
// On a real Windows machine with a certificate, remove "sign" from package.json
// and electron-builder will sign normally. Unsigned EXE shows a SmartScreen
// warning on first run — click "More info > Run anyway".
module.exports = async function (configuration) {
  console.log('[mayaacc] skipping code signing for', configuration.path);
};
