// api/developer-device.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import os from 'os';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const ifaces = os.networkInterfaces();
    const macs = Object.values(ifaces)
      .flat()
      .filter(i => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
      .map(i => i!.mac.toUpperCase().replace(/:/g, '-'));
    const uniqueMacs = [...new Set(macs)];

    res.status(200).json({
      success: true,
      macAddresses: uniqueMacs,
      hostname: os.hostname(),
      platform: os.platform()
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || String(err)
    });
  }
}
