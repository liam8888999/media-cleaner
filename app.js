const express = require('express');
const session = require('express-session');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 47199;

const createDirectoryIfNotExists = (directoryPath) => {
  if (directoryPath && directoryPath.trim() !== '') {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    console.log(`Directory created: ${directoryPath}`);
  } else {
    console.error(`Directory already exists, will not be created: ${directoryPath}`);
  }
}
};

// Use sessions
app.use(session({
  secret: 'your-secret-key', // Change this to a secure random string
  resave: false,
  saveUninitialized: true,
}));

app.set('view engine', 'ejs');
app.set('views', path.join('/home/liam2003/media-cleaner', 'views'))
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

let videoDirectory = '/home/liam2003/archive-cleaner-files/archive-cleaner/!Individual User Folders/Liam/web-test';

app.get('/', async (req, res) => {
   res.render('welcome')
  // Redirect to the /next route
 // res.redirect('/next');
});
async function listFilesInDir(directoryPath) {
  try {
    const files = await fs.promises.readdir(directoryPath);
    const filePromises = files.map(async (file) => {
      const filePath = path.join(directoryPath, file);
      const stat = await fs.promises.stat(filePath);

      if (stat.isDirectory()) {
        if (!file.startsWith('.')) { // Ignore hidden directories
          const subFiles = await listFilesInDir(filePath); // Recursive call
          return subFiles;
        }
      } else {
        if (!file.startsWith('.')) { // Ignore hidden files
          return filePath;
        }
      }
    });

    const results = await Promise.all(filePromises);
    return results.flat().filter(Boolean); // Remove undefined values
  } catch (error) {
    console.error(`Error reading directory for directory listing: ${error}`);
    return [];
  }
}
app.get('/next', async (req, res) => {
  req.session.renameCounter = req.session.renameCounter || 0;
  req.session.discorduser = req.query.discorduser;
  console.log("next" + req.session.discorduser);

  let unsuretxt = req.query.unsure;
  let currentVideounsure = req.query.currentVideo;
  console.log(currentVideounsure);

  try {
    const files = await listFilesInDir(videoDirectory);
    console.log(files);

    // Filter out files starting with a dot (hidden files) and select compatible video files
    const filteredFiles = files.filter(file => {
      return !file.startsWith('.') && /\.(mp4|webm|ogg)$/i.test(file);
    });

    if (filteredFiles.length === 0) {
      return res.render('index', { videoInfo: null, noVideo: true });
    }

   
     let newVideo;
do {
  newVideo = filteredFiles[Math.floor(Math.random() * filteredFiles.length)];
} while (newVideo === req.session.currentVideo);

req.session.currentVideo = newVideo;

} else {
  // Randomly select the first video if not set in the session
  if (!req.session.currentVideo) {
    req.session.currentVideo = filteredFiles[Math.floor(Math.random() * filteredFiles.length)];
  }
}

    const videoPath = req.session.currentVideo;
    const videoInfo = await getVideoInfo(videoPath);
     let progress = req.session.renameCounter;
console.log("counter: " + progress)
    res.render('index', { videoInfo, noVideo: false, progress });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error reading video files.');
  }
});



async function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error(err);
        reject('Error processing video file.');
      }

      const durationInSeconds = metadata.format.duration;
      const hours = Math.floor(durationInSeconds / 3600);
      const minutes = Math.floor((durationInSeconds % 3600) / 60);
      const seconds = Math.floor(durationInSeconds % 60);

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      const resolution = {
        width: videoStream.width,
        height: videoStream.height,
      };

      const videoInfo = {
        codec: videoStream.codec_name,
        videoname: videoPath.replace(videoDirectory, ''),
        filename: videoPath,
        duration: `${hours}:${minutes}:${seconds}`,
        resolution: resolution,
      };

      resolve(videoInfo);
    });
  });
}

app.get('/video/:path*', (req, res) => {
  const videoPath = path.join(videoDirectory, req.params.path, req.params[0]);

  try {
    const stat = fs.statSync(videoPath);
    const videoStream = fs.createReadStream(videoPath);

    res.writeHead(200, {
      'Content-Length': stat.size,
    });

    videoStream.pipe(res);
  } catch (error) {
    console.error('Error serving video:', error);
    res.status(404).send('Not Found');
  }
});


app.post('/rename', (req, res) => {
  const userSession = req.session;

 // Initialize a counter if not present in the session
 userSession.renameCounter = userSession.renameCounter || 0;

 // Increment the counter
 userSession.renameCounter++;

  const currentVideo = req.body.currentVideo;
  const showName = req.body.showName;
  const season = req.body.newseason;
  const episode = req.body.newepisode;
  const episodeName = req.body.episodeName;
  const newGenre = req.body.newGenre;
  const newCollection = req.body.newCollection;
  const newLocation = newCollection + "/" + newGenre

  const newName = `${showName} - ${season}x${episode} - ${episodeName}`

  const fileExtension = path.extname(currentVideo);

  if (!newLocation) {
    return res.status(400).send('New Location is required.');
  }

  const newFileLocation = path.join('/home/liam2003/archive-cleaner-files/archive-cleaner/!Individual User Folders/Liam/web-test-renamed', newLocation, `${newName}${fileExtension}`);
  const newFolderLocation = path.join('/home/liam2003/archive-cleaner-files/archive-cleaner/\!Individual\ User\ Folders/Liam/web-test-renamed', newLocation);
  console.log(newFileLocation)
  createDirectoryIfNotExists(newFolderLocation)
  fs.rename(currentVideo, newFileLocation, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error moving the file.');
    }

    // Check if the user has made 15 rename requests
        if (userSession.renameCounter === 15) {
          // Display a message to the user
          res.send('Congratulations! You have made 15 rename requests. The current access details are:');
        } else {
          // Redirect to the home page or any other desired page
          res.redirect('/next');
        }
  });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
