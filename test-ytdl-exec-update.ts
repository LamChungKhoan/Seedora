import { create } from 'youtube-dl-exec';
import fs from 'fs';

async function test() {
  try {
    const youtubedl = create('/app/applet/node_modules/youtube-dl-exec/bin/yt-dlp');
    console.log('Downloading...');
    await youtubedl('https://www.youtube.com/watch?v=Gdp5uNbMbU8', {
      extractAudio: true,
      audioFormat: 'mp3',
      output: 'temp_audio.%(ext)s',
    });
    console.log('Downloaded!');
  } catch (e) {
    console.error(e);
  }
}
test();
