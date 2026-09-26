WAAAT POS — easy Windows setup

1. Install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/
   If Docker asks to enable WSL 2 or restart Windows, follow its instructions.
2. Download and extract the WAAAT-POS-Windows folder to Documents. Do not run it from inside the ZIP preview.
3. Open Docker Desktop and wait until it says Docker Engine is running.
4. Double-click Start-WAAAT.bat. The first start takes a few minutes while Docker loads the app and database.
5. The sign-in page opens automatically. Use the email and password in WAAAT-Login.txt in this folder.
6. In the app, open Users and create a STAFF account for each cashier. Keep WAAAT-Login.txt private.

If Windows asks whether Docker Desktop may access the private network, allow it on Private networks. The app is only available on this laptop at http://127.0.0.1:3000/login.

To print: install the TVS RP-3160 Gold driver by following INSTALL-PRINTER.txt. Then select the RP-3160 Gold from Chrome's print dialog.

To stop: double-click Stop-WAAAT.bat. Bills stay saved on this laptop. To start again, open Docker Desktop and double-click Start-WAAAT.bat.

The database belongs to this laptop. It does not copy your other computer's bills. Keep this folder and Docker's app data safe; arrange regular backups before using it for real sales. Do not delete the waaat-pos database volume.
