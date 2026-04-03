import { Innertube, UniversalCache } from 'youtubei.js';
async function test() {
  try {
    const yt = await Innertube.create({ cache: new UniversalCache(false) });
    const info = await yt.getInfo('Gdp5uNbMbU8');
    const transcriptData = await info.getTranscript();
    console.log(transcriptData.transcript.content.body.initial_segments.slice(0, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
