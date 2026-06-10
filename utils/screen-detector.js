const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

class ScreenDetector {
  constructor() {
    this.screenInfo = null;
  }

  async detectScreenResolution() {
    console.log('🖥️ Detecting screen resolution...');
    
    const configuredScreen = this.getConfiguredScreenInfo();
    if (configuredScreen) {
      this.screenInfo = configuredScreen;
      this.logScreenInfo(configuredScreen);
      return configuredScreen;
    }

    const windowsScreen = this.getWindowsScreenInfo();
    if (windowsScreen) {
      this.screenInfo = windowsScreen;
      this.logScreenInfo(windowsScreen);
      return windowsScreen;
    }

    let browser = null;
    try {
      // Launch a temporary browser to detect screen resolution
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Get screen information
      const screenInfo = await page.evaluate(() => {
        return {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          devicePixelRatio: window.devicePixelRatio,
          colorDepth: screen.colorDepth,
          orientation: screen.orientation ? screen.orientation.type : 'unknown'
        };
      });
      
      this.screenInfo = screenInfo;
      
      console.log('✅ Screen resolution detected:');
      console.log(`   Full Screen: ${screenInfo.width}x${screenInfo.height}`);
      console.log(`   Available: ${screenInfo.availWidth}x${screenInfo.availHeight}`);
      console.log(`   Device Pixel Ratio: ${screenInfo.devicePixelRatio}`);
      console.log(`   Color Depth: ${screenInfo.colorDepth}`);
      console.log(`   Orientation: ${screenInfo.orientation}`);
      
      return screenInfo;
      
    } catch (error) {
      console.error('❌ Failed to detect screen resolution:', error.message);
      // Fallback to common resolution
      this.screenInfo = {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        devicePixelRatio: 1,
        colorDepth: 24,
        orientation: 'landscape-primary'
      };
      return this.screenInfo;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  getConfiguredScreenInfo() {
    const width = Number(process.env.BROWSER_WIDTH || process.env.SCREEN_WIDTH);
    const height = Number(process.env.BROWSER_HEIGHT || process.env.SCREEN_HEIGHT);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1024 || height < 720) {
      return null;
    }

    return {
      width,
      height,
      availWidth: width,
      availHeight: height,
      devicePixelRatio: Number(process.env.DEVICE_SCALE_FACTOR || 1),
      colorDepth: 24,
      orientation: width >= height ? 'landscape-primary' : 'portrait-primary'
    };
  }

  getWindowsScreenInfo() {
    if (process.platform !== 'win32') {
      return null;
    }

    try {
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms;',
        '$screen = [System.Windows.Forms.Screen]::PrimaryScreen;',
        '$bounds = $screen.Bounds;',
        '$working = $screen.WorkingArea;',
        '[Console]::WriteLine("{0},{1},{2},{3}", $bounds.Width, $bounds.Height, $working.Width, $working.Height)'
      ].join(' ');
      const output = execFileSync('powershell', ['-NoProfile', '-Command', script], {
        encoding: 'utf8',
        windowsHide: true
      }).trim();
      const [width, height, availWidth, availHeight] = output.split(',').map(Number);

      if ([width, height, availWidth, availHeight].every((value) => Number.isFinite(value) && value > 0)) {
        return {
          width,
          height,
          availWidth,
          availHeight,
          devicePixelRatio: Number(process.env.DEVICE_SCALE_FACTOR || 1),
          colorDepth: 24,
          orientation: width >= height ? 'landscape-primary' : 'portrait-primary'
        };
      }
    } catch (error) {
      console.log(`Windows screen detection unavailable: ${error.message}`);
    }

    return null;
  }

  logScreenInfo(screenInfo) {
    console.log('Screen resolution detected:');
    console.log(`   Full Screen: ${screenInfo.width}x${screenInfo.height}`);
    console.log(`   Available: ${screenInfo.availWidth}x${screenInfo.availHeight}`);
    console.log(`   Device Pixel Ratio: ${screenInfo.devicePixelRatio}`);
    console.log(`   Color Depth: ${screenInfo.colorDepth}`);
    console.log(`   Orientation: ${screenInfo.orientation}`);
  }

  getOptimalViewport(percentage = 100) {
    if (!this.screenInfo) {
      throw new Error('Screen resolution not detected. Call detectScreenResolution() first.');
    }

    const availableWidth = this.screenInfo.availWidth || this.screenInfo.width;
    const availableHeight = this.screenInfo.availHeight || this.screenInfo.height;
    const targetWidth = Math.floor(availableWidth * (percentage / 100));
    const targetHeight = Math.floor(availableHeight * (percentage / 100));

    // Ensure minimum viable size
    const minWidth = 1024;
    const minHeight = 720;

    const viewport = {
      width: Math.min(Math.max(targetWidth, minWidth), availableWidth),
      height: Math.min(Math.max(targetHeight, minHeight), availableHeight)
    };

    console.log(`🎯 Optimal viewport (${percentage}%): ${viewport.width}x${viewport.height}`);
    return viewport;
  }

  getBrowserArgs(percentage = 100) {
    const viewport = this.getOptimalViewport(percentage);
    
    return [
      '--start-maximized',
      `--window-size=${viewport.width},${viewport.height}`,
      '--window-position=0,0',
      '--force-device-scale-factor=1',
      '--high-dpi-support=1',
      '--disable-web-security',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];
  }

  getScreenInfo() {
    return this.screenInfo;
  }

  static async getQuickViewport(percentage = 80) {
    const detector = new ScreenDetector();
    await detector.detectScreenResolution();
    return detector.getOptimalViewport(percentage);
  }

  static async getQuickBrowserArgs(percentage = 80) {
    const detector = new ScreenDetector();
    await detector.detectScreenResolution();
    return detector.getBrowserArgs(percentage);
  }
}

module.exports = { ScreenDetector };

// CLI usage for testing
if (require.main === module) {
  const detector = new ScreenDetector();
  detector.detectScreenResolution()
    .then(() => {
      console.log('\n🎯 Viewport Options:');
      console.log('60%:', detector.getOptimalViewport(60));
      console.log('80%:', detector.getOptimalViewport(80));
      console.log('90%:', detector.getOptimalViewport(90));
      
      console.log('\n🚀 Browser Args (80%):');
      console.log(detector.getBrowserArgs(80).join(' '));
    })
    .catch(console.error);
}
