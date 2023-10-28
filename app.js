const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

let videoDirectory = path.join(__dirname, 'videos');

app.get('/', (req, res) => {
  fs.readdir(videoDirectory, (err, files) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error reading video files.');
    }

    // Filter out files starting with a dot (hidden files)
    files = files.filter(file => !file.startsWith('.'));

    if (files.length === 0) {
      // Display the "No video files found" message graphically
      return res.render('index', { videoInfo: null, noVideo: true });
    }

    // Pick the first video file from the directory
    const currentVideo = files[0];
    const videoPath = path.join(videoDirectory, currentVideo);

    // Display video information and rename form
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error processing video file.');
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
        videoname: currentVideo,
        filename: videoPath,
        duration: `${hours}:${minutes}:${seconds}`,
        resolution: resolution,
      };

      res.render('index', { videoInfo, noVideo: false });
    });
  });
});

app.get('/video/:filename', (req, res) => {
  const videoPath = path.join(videoDirectory, req.params.filename);
  const stat = fs.statSync(videoPath);

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Content-Length': stat.size,
  });

  const videoStream = fs.createReadStream(videoPath);
  videoStream.pipe(res);
});

app.post('/rename', (req, res) => {
  const currentVideo = req.body.currentVideo;
  const newFileName = req.body.newFileName;
  const newLocation = req.body.newLocation;

  const fileExtension = path.extname(currentVideo);

  if (!newLocation) {
    return res.status(400).send('New Location is required.');
  }

  const newFileLocation = path.join(newLocation, `${newFileName}${fileExtension}`);
  console.log(newFileLocation)
  fs.rename(currentVideo, newFileLocation, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error moving the file.');
    }

    res.redirect('/');
  });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
