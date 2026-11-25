// Salin kode ini ke Google Spreadsheet -> Extensions -> Apps Script -> Deploy as Web App
// Execute as: Me | Who has access: Anyone (atau Anyone with the link)
// Setelah deploy, salin Web App URL (https://script.google.com/macros/s/.../exec)
// ke environment variable GOOGLE_SHEETS_WEBHOOK_URL atau langsung di pengaturan aplikasi.

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = payload.sheets || [];
    var totalRows = 0;

    sheets.forEach(function (item) {
      var sheet = ss.getSheetByName(item.sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(item.sheetName);
      }
      sheet.clearContents();

      var headers = item.headers || [];
      var rows = item.rows || [];
      if (headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      }
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        totalRows += rows.length;
      }
      sheet.autoResizeColumns(1, Math.max(1, headers.length));
    });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, totalRows: totalRows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
