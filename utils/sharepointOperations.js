const axios = require('axios');
const { getSharePointToken } = require('./sharepointAuth');

// Configuration variables for SharePoint
const SHAREPOINT_SITE_ID = process.env.SHAREPOINT_SITE_ID;

// Function to validate the access token format
function isValidJWT(token) {
  return token && token.split('.').length === 3;
}

// Function to create a folder in SharePoint
async function createSharePointFolder(folderName) {
  const ACCESS_TOKEN = await getSharePointToken();

  if (!isValidJWT(ACCESS_TOKEN)) {
    throw new Error('Invalid access token format');
  }

  const folderCreationUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest:/children`;

  try {
    await axios.post(
      folderCreationUrl,
      {
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Folder created successfully in SharePoint.');
  } catch (error) {
    console.error(
      'Error creating folder in SharePoint:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error creating folder in SharePoint');
  }
}

// Function to upload a file to SharePoint
async function uploadFileToSharePoint(folderName, fileName, fileContent) {
  const ACCESS_TOKEN = await getSharePointToken();

  if (!isValidJWT(ACCESS_TOKEN)) {
    throw new Error('Invalid access token format');
  }

  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest/${folderName}/${fileName}:/content`;

  try {
    await axios.put(uploadUrl, fileContent, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('File uploaded successfully to SharePoint.');
  } catch (error) {
    console.error(
      'Error uploading file to SharePoint:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error uploading file to SharePoint');
  }
}

// Function to get all files and folders in SharePoint
async function getAllFilesAndFolders() {
  const ACCESS_TOKEN = await getSharePointToken();

  if (!isValidJWT(ACCESS_TOKEN)) {
    throw new Error('Invalid access token format');
  }

  const listUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest:/children`;

  try {
    const response = await axios.get(listUrl, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });
    return response.data.value;
  } catch (error) {
    console.error(
      'Error listing files and folders in SharePoint:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error listing files and folders in SharePoint');
  }
}

// Function to delete a file or folder in SharePoint
async function deleteFileOrFolder(itemPath) {
  const ACCESS_TOKEN = await getSharePointToken();

  if (!isValidJWT(ACCESS_TOKEN)) {
    throw new Error('Invalid access token format');
  }

  const deleteUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest/${itemPath}`;

  try {
    await axios.delete(deleteUrl, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });
    console.log(`Item "${itemPath}" deleted successfully from SharePoint.`);
  } catch (error) {
    console.error(
      'Error deleting item from SharePoint:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error deleting item from SharePoint');
  }
}

// Function to update a file in SharePoint
async function updateFile(filePath, fileContent) {
  const ACCESS_TOKEN = await getSharePointToken();

  if (!isValidJWT(ACCESS_TOKEN)) {
    throw new Error('Invalid access token format');
  }

  const updateUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest/${filePath}:/content`;

  try {
    await axios.put(updateUrl, fileContent, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`File "${filePath}" updated successfully in SharePoint.`);
  } catch (error) {
    console.error(
      'Error updating file in SharePoint:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error updating file in SharePoint');
  }
}

// Function to get the latest version of a file
async function getLatestVersion(fileName) {
  try {
    const fileInfo = await spo.web
      .getFileByServerRelativeUrl(`/Shared Documents/${fileName}`)
      .select('UIVersionLabel')
      .get();
    return fileInfo.UIVersionLabel;
  } catch (error) {
    console.error('Error getting latest version:', error);
    throw error;
  }
}

// Function to get a file from SharePoint
async function getFileFromSharePoint(folderName, fileName) {
  const ACCESS_TOKEN = await getSharePointToken();

  if (!isValidJWT(ACCESS_TOKEN)) {
    throw new Error('Invalid access token format');
  }

  console.log('folderName:', folderName);
  console.log('fileName:', fileName);

  const fileUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:/SharePointTest/${folderName}/${fileName}:/content`;

  try {
    const response = await axios.get(fileUrl, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      responseType: 'json', // Change this to 'json'
    });
    const content = response.data;
    console.log('Content from SharePoint:', content);

    // If the content is already an object, return it directly
    if (typeof content === 'object' && content !== null) {
      return content;
    }

    // If it's a string, try to parse it as JSON
    if (typeof content === 'string') {
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Error parsing content as JSON:', parseError);
        throw new Error('Invalid JSON content');
      }
    }

    // If it's neither an object nor a string, throw an error
    throw new Error('Unexpected content type');
  } catch (error) {
    console.error(
      'Error getting file from SharePoint:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error getting file from SharePoint');
  }
}

module.exports = {
  createSharePointFolder,
  uploadFileToSharePoint,
  getAllFilesAndFolders,
  deleteFileOrFolder,
  updateFile,
  getLatestVersion,
  getFileFromSharePoint,
};
