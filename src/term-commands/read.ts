import * as logReader from '../lib/log-reader.js';

export async function readSessionLogs(sessionName: string, options: any): Promise<void> {
  try {
    // Parse options
    const readOptions: logReader.ReadOptions = {
      lines: options.lines ? parseInt(options.lines, 10) : 100,
      from: options.from ? parseInt(options.from, 10) : undefined,
      to: options.to ? parseInt(options.to, 10) : undefined,
      range: options.range,
      search: options.search,
      grep: options.grep,
      follow: options.follow,
      all: options.all,
      reverse: options.reverse,
    };

    // Handle follow mode
    if (options.follow) {
      console.log(`📡 Following session "${sessionName}" (Ctrl+C to stop)...`);
      console.log('');

      const stopFollowing = await logReader.followSessionLogs(sessionName, (line) => {
        console.log(line);
      });

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        stopFollowing();
        console.log('\n✅ Stopped following');
        process.exit(0);
      });

      // Keep process running
      await new Promise(() => {});
      return;
    }

    // Regular read mode
    const content = await logReader.readSessionLogs(sessionName, readOptions);
    console.log(content);
  } catch (error: any) {
    console.error(`❌ Error reading session logs: ${error.message}`);
    process.exit(1);
  }
}
