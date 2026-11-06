import { describe, expect, it } from 'vitest';
import { getBrowserCaptureSupport } from '../../renderer/lib/browserRecorder';

function secureEnvironment(overrides = {}) {
  return {
    isSecureContext: true,
    navigator: { mediaDevices: { getUserMedia() {}, getDisplayMedia() {} } },
    AudioContext() {},
    MediaRecorder() {},
    ...overrides,
  };
}

describe('browser recording capability checks', () => {
  it('explains why VM-IP HTTP capture is unavailable instead of dereferencing mediaDevices', () => {
    const result = getBrowserCaptureSupport({ includeTab: true, environment: { isSecureContext: false, navigator: {} } });
    expect(result).toMatchObject({ supported: false, code: 'INSECURE_CONTEXT' });
    expect(result.reason).toContain('plain HTTP');
    expect(result.reason).toContain('Chrome extension');
  });

  it('detects a browser with microphone support but no shared-tab API', () => {
    const environment = secureEnvironment({ navigator: { mediaDevices: { getUserMedia() {} } } });
    expect(getBrowserCaptureSupport({ includeTab: true, environment })).toMatchObject({
      supported: false,
      code: 'DISPLAY_CAPTURE_UNAVAILABLE',
    });
    expect(getBrowserCaptureSupport({ environment })).toMatchObject({ supported: true });
  });

  it('accepts a secure Chrome-like recording environment', () => {
    expect(getBrowserCaptureSupport({ includeTab: true, environment: secureEnvironment() })).toEqual({
      supported: true,
      code: 'SUPPORTED',
      reason: '',
    });
  });
});
