import ytdl from '@distube/ytdl-core';
import fs from 'fs';

async function test() {
  try {
    const res = await fetch('https://proxylist.geonode.com/api/proxy-list?limit=10&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps');
    const data = await res.json();
    const proxies = data.data.map((p: any) => p.protocols[0] + '://' + p.ip + ':' + p.port);
    
    for (const proxy of proxies) {
      console.log('Trying proxy:', proxy);
      try {
        const agent = ytdl.createProxyAgent({ uri: proxy });
        const info = await ytdl.getInfo('https://www.youtube.com/watch?v=Gdp5uNbMbU8', { agent });
        console.log(info.videoDetails.title);
        return;
      } catch (e: any) {
        console.error('Proxy failed:', e.message);
      }
    }
  } catch (e) {
    console.error(e);
  }
}
test();
