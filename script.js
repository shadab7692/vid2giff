const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });
const videoInput = document.getElementById('videoInput');
const videoPreview = document.getElementById('videoPreview');
const convertBtn = document.getElementById('convertBtn');
const downloadLink = document.getElementById('downloadLink');
const status = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const gifPreview = document.getElementById('gifPreview');
const frameRateInput = document.getElementById('frameRate');
const widthInput = document.getElementById('width');
const qualityInput = document.getElementById('quality');

let videoFile = null;

// Load FFmpeg
async function loadFFmpeg() {
  status.textContent = 'Loading FFmpeg...';
  await ffmpeg.load();
  status.textContent = 'FFmpeg loaded.';
}

// Progress indicator
ffmpeg.setProgress(({ ratio }) => {
  const progress = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  progressBar.value = progress;
  progressBar.style.display = 'block';
  status.textContent = `Converting... ${progress}%`;
});

// Handle video file selection
videoInput.addEventListener('change', async (e) => {
  videoFile = e.target.files[0];
  if (!videoFile) return;

  status.textContent = 'Processing video...';
  videoPreview.style.display = 'block';
  videoPreview.src = URL.createObjectURL(videoFile);
  gifPreview.style.display = 'none';
  downloadLink.style.display = 'none';
  progressBar.style.display = 'none';

  // Check video duration
  videoPreview.onloadedmetadata = async () => {
    const duration = videoPreview.duration;
    if (duration < 2.5 || duration > 3.5) {
      status.textContent = 'Error: Video must be approximately 3 seconds long.';
      convertBtn.disabled = true;
      videoPreview.style.display = 'none';
      return;
    }
    status.textContent = 'Video ready. Customize settings and click "Convert to GIF".';
    convertBtn.disabled = false;
  };
});

// Convert video to GIF
convertBtn.addEventListener('click', async () => {
  if (!videoFile) return;

  status.textContent = 'Preparing conversion...';
  convertBtn.disabled = true;
  progressBar.style.display = 'block';
  progressBar.value = 0;
  gifPreview.style.display = 'none';
  downloadLink.style.display = 'none';

  try {
    // Get customization values
    const frameRate = Math.max(1, Math.min(30, parseInt(frameRateInput.value) || 10));
    const width = Math.max(100, Math.min(1280, parseInt(widthInput.value) || 320));
    const quality = Math.max(1, Math.min(10, parseInt(qualityInput.value) || 8));

    // Determine file extension
    const ext = videoFile.name.split('.').pop().toLowerCase();
    const inputFile = `input.${ext}`;

    // Write video file to FFmpeg's virtual filesystem
    ffmpeg.FS('writeFile', inputFile, await fetchFile(videoFile));

    // Calculate quality (map 1-10 to FFmpeg's palettegen max_colors)
    const maxColors = Math.round(quality * 25.6); // 1->26, 10->256 colors

    // Run FFmpeg commands for GIF conversion with palette
    await ffmpeg.run(
      '-i', inputFile,
      '-t', '3', // Limit to 3 seconds
      '-vf', `fps=${frameRate},scale=${width}:-1:flags=lanczos,palettegen=max_colors=${maxColors}`,
      '-f', 'gif',
      'palette.png'
    );
    await ffmpeg.run(
      '-i', inputFile,
      '-i', 'palette.png',
      '-t', '3',
      '-lavfi', `fps=${frameRate},scale=${width}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer`,
      '-f', 'gif',
      'output.gif'
    );

    // Read the output GIF
    const data = ffmpeg.FS('readFile', 'output.gif');
    const gifBlob = new Blob([data.buffer], { type: 'image/gif' });
    const gifUrl = URL.createObjectURL(gifBlob);

    // Display GIF preview
    gifPreview.src = gifUrl;
    gifPreview.style.display = 'block';

    // Set up download link
    downloadLink.href = gifUrl;
    downloadLink.download = 'converted.gif';
    downloadLink.style.display = 'inline-block';
    downloadLink.textContent = 'Download GIF';

    status.textContent = 'Conversion complete!';
    progressBar.style.display = 'none';
  } catch (error) {
    status.textContent = 'Error during conversion: ' + error.message;
    convertBtn.disabled = false;
    progressBar.style.display = 'none';
  }
});

// Initialize FFmpeg on page load
loadFFmpeg();