import youtubedl from 'youtube-dl-exec';
import fs from 'fs';

async function test() {
  try {
    console.log('Downloading...');
    await youtubedl('https://www.youtube.com/watch?v=Gdp5uNbMbU8', {
      extractAudio: true,
      audioFormat: 'mp3',
      output: 'temp_audio.%(ext)s',
    });
    console.log('Downloaded!');
    console.log(fs.existsSync('temp_audio.mp3'));
  } catch (e) {
    console.error(e);
  }
}
test();
