import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseMessenger } from '../src/shared/BaseMessenger.js';
import { ACTIONS } from '../src/shared/constants.js';

describe('BaseMessenger', () => {
    let messenger;
    let mockWindow;

    beforeEach(() => {
        // Setup mock window object
        mockWindow = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            postMessage: vi.fn(),
            location: { origin: 'http://localhost:3000' },
        };

        global.window = mockWindow;
    });

    afterEach(() => {
        if (messenger) {
            messenger.destroy();
        }
    });

    describe('Constructor', () => {
        it('should create a messenger instance', () => {
            messenger = new BaseMessenger({ isChildFrame: false });
            expect(messenger).toBeDefined();
            expect(messenger.isChildFrame).toBe(false);
        });

        it('should register message event listener', () => {
            messenger = new BaseMessenger({ isChildFrame: false });
            expect(mockWindow.addEventListener).toHaveBeenCalledWith(
                'message',
                expect.any(Function)
            );
        });

        it('should set constant properties', () => {
            messenger = new BaseMessenger({ isChildFrame: true });
            expect(messenger.isChildFrame).toBe(true);
            
            // Should not be modifiable
            expect(() => {
                messenger.isChildFrame = false;
            }).toThrow();
        });
    });

    describe('Built-in Handlers', () => {
        it('should handle PING action', async () => {
            messenger = new BaseMessenger({ isChildFrame: false });
            const handlers = messenger.getBuiltInHandlers();
            
            expect(handlers[ACTIONS.PING]).toBeDefined();
            
            const result = handlers[ACTIONS.PING]();
            expect(result).toHaveProperty('type', ACTIONS.PONG);
            expect(result).toHaveProperty('timestamp');
        });
    });

    describe('sendMessage', () => {
        it('should send a message and return a promise', async () => {
            messenger = new BaseMessenger({ isChildFrame: false });
            
            const targetWindow = {
                postMessage: vi.fn(),
            };

            const promise = messenger.sendMessage(
                targetWindow,
                'testAction',
                { foo: 'bar' }
            );

            expect(promise).toBeInstanceOf(Promise);
            expect(targetWindow.postMessage).toHaveBeenCalled();
        });

        it('should timeout if no response received', async () => {
            messenger = new BaseMessenger({
                isChildFrame: false,
                timeout: 100, // Short timeout for test
            });

            const targetWindow = {
                postMessage: vi.fn(),
            };

            await expect(
                messenger.sendMessage(targetWindow, 'testAction', {})
            ).rejects.toThrow('Message timed out');
        });
    });

    describe('Origin Validation', () => {
        it('should accept messages from allowed origins', () => {
            messenger = new BaseMessenger({
                isChildFrame: false,
                allowedOrigins: ['http://localhost:3000'],
            });

            const isValid = messenger.validator.validate('http://localhost:3000');
            expect(isValid).toBe(true);
        });

        it('should reject messages from disallowed origins', () => {
            messenger = new BaseMessenger({
                isChildFrame: false,
                allowedOrigins: ['http://localhost:3000'],
            });

            const isValid = messenger.validator.validate('http://evil.com');
            expect(isValid).toBe(false);
        });

        it('should support wildcard patterns', () => {
            messenger = new BaseMessenger({
                isChildFrame: false,
                allowedOrigins: ['https://*.example.com'],
            });

            expect(messenger.validator.validate('https://app.example.com')).toBe(true);
            expect(messenger.validator.validate('https://api.example.com')).toBe(true);
            expect(messenger.validator.validate('https://example.com')).toBe(false);
            expect(messenger.validator.validate('https://evil.com')).toBe(false);
        });
    });

    describe('destroy', () => {
        it('should remove event listener', () => {
            messenger = new BaseMessenger({ isChildFrame: false });
            messenger.destroy();

            expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
                'message',
                expect.any(Function)
            );
        });

        it('should reject pending promises', async () => {
            messenger = new BaseMessenger({ isChildFrame: false });

            const targetWindow = { postMessage: vi.fn() };
            const promise = messenger.sendMessage(targetWindow, 'test', {});

            messenger.destroy();

            await expect(promise).rejects.toThrow('Messenger destroyed');
        });
    });

    describe('Log Levels', () => {
        it('should accept numeric log level', () => {
            messenger = new BaseMessenger({
                isChildFrame: false,
                logLevel: 0, // Silent
            });

            expect(messenger.logger.level).toBe(0);
        });

        it('should accept string log level', () => {
            messenger = new BaseMessenger({
                isChildFrame: false,
                logLevel: 'debug',
            });

            expect(messenger.logger.level).toBe(4); // DEBUG level
        });

        it('should allow changing log level', () => {
            messenger = new BaseMessenger({
                isChildFrame: false,
                logLevel: 'info',
            });

            messenger.setLogLevel('silent');
            expect(messenger.logger.level).toBe(0);
        });
    });
});
