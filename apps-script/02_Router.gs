/***************************************
 * 02_Router.gs
 * API 라우터
 ***************************************/

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseBody(e) {
  try {
    return JSON.parse(e.postData.contents || "{}");
  } catch (err) {
    return {};
  }
}

function doGet(e) {
  const action = e.parameter.action || "";

  try {
    switch (action) {
      case "health":
        return jsonOutput({ success: true, message: "API 정상 연결" });

      case "checkAdminPassword":
        return jsonOutput(checkAdminPassword(e));

      case "months":
        return jsonOutput(getAvailableMonths());

      case "dashboard":
        return jsonOutput(getDashboardSummary(e));

      case "list":
        return jsonOutput(getJobList(e));

      case "init":
        return jsonOutput(getInitData(e));

      case "deleteRequestsAll":
        return jsonOutput(getDeleteRequestsAll());

      case "clearAppCache":
        return jsonOutput(clearAppCache());

      case "repairLinks":
        return jsonOutput(repairMissingFolderLinks(e));

      case "partnerInstallerData":
        return jsonOutput(getPartnerInstallerData_());

      case "photoCounts":
        return jsonOutput(getPhotoCounts(e));

      default:
        return jsonOutput({
          success: false,
          message: "지원하지 않는 GET action: " + action
        });
    }
  } catch (err) {
    return jsonOutput({
      success: false,
      message: err.toString()
    });
  }
}

function doPost(e) {
  const body = parseBody(e);
  const action = body.action || "";

  try {
    switch (action) {

      case "partnerLogin":
        return jsonOutput(partnerLogin(body.id, body.password));

      case "getPartnerJobs":
        return jsonOutput(getPartnerJobs(body));

      case "assignEngineer":
        return jsonOutput(assignEngineer(body));

      case "addHistory":
        return jsonOutput(addHistory(body));

      case "completeJob":
        return jsonOutput(completeJob(body));

      case "saveOrder":
        return jsonOutput(saveOrder(body));

      case "updateOrder":
        return jsonOutput(updateOrder(body));

      case "adminUpdateOrder":
        return jsonOutput(adminUpdateOrder(body));

      case "requestDelete":
        return jsonOutput(requestDelete(body));

      case "approveDelete":
        return jsonOutput(approveDelete(body));

      case "hardDelete":
        return jsonOutput(hardDelete(body));

      case "setEditLock":
        return jsonOutput(setEditLock(body));

      case "uploadPhoto":
        return jsonOutput(uploadPhotoWithLockGuard(body));

      case "uploadDrawing":
        return jsonOutput(uploadDrawingWithLockGuard(body));

      case "addImportantHistory":
        return jsonOutput(addImportantHistory(body));

      default:
        return jsonOutput({
          success: false,
          message: "지원하지 않는 POST action: " + action
        });
    }
  } catch (err) {
    return jsonOutput({
      success: false,
      message: err.toString()
    });
  }
}
