const express = require('express');
const session = require('express-session');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Use sessions
app.use(session({
  secret: 'your-secret-key', // Change this to a secure random string
  resave: false,
  saveUninitialized: true,
}));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

let videoDirectory = '/Users/liam/Documents/GitHub/media-cleaner/videos';

app.get('/', (req, res) => {
  // Redirect to the /next route
  res.redirect('/next');
});

app.get('/next', async (req, res) => {
  const userSession = req.session;

  try {
    const files = await fs.promises.readdir(videoDirectory);

    // Filter out files starting with a dot (hidden files)
    const filteredFiles = files.filter(file => !file.startsWith('.'));

    if (filteredFiles.length === 0) {
      return res.render('index', { videoInfo: null, noVideo: true });
    }

    // Randomly select the first video if not set in the session
    if (!userSession.currentVideo) {
      userSession.currentVideo = filteredFiles[Math.floor(Math.random() * filteredFiles.length)];
    }

    const videoPath = path.join(videoDirectory, userSession.currentVideo);
    const videoInfo = await getVideoInfo(videoPath);

    res.render('index', { videoInfo, noVideo: false });
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
        videoname: path.basename(videoPath),
        filename: videoPath,
        duration: `${hours}:${minutes}:${seconds}`,
        resolution: resolution,
      };

      resolve(videoInfo);
    });
  });
}

app.get('/video/:filename', (req, res) => {
  const videoPath = path.join(videoDirectory, req.params.filename);
  console.log(videoPath)
  const stat = fs.statSync(videoPath);

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Content-Length': stat.size,
  });

  const videoStream = fs.createReadStream(videoPath);
  videoStream.pipe(res);
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
  const newLocation = req.body.newLocation;

  const newName = `${showName} - ${season}x${episode} - ${episodeName}`

  const fileExtension = path.extname(currentVideo);

  if (!newLocation) {
    return res.status(400).send('New Location is required.');
  }

  const newFileLocation = path.join(newLocation, `${newName}${fileExtension}`);
  console.log(newFileLocation)
  fs.rename(currentVideo, newFileLocation, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error moving the file.');
    }

    // Check if the user has made 15 rename requests
        if (userSession.renameCounter === 15) {
          // Display a message to the user
          res.send('Congratulations! You have made 15 rename requests.');
        } else {
          // Redirect to the home page or any other desired page
          res.redirect('/');
        }
  });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
