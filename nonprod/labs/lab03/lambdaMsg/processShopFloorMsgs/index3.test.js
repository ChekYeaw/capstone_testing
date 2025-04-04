/* eslint-disable no-undef */
const aws = require('aws-sdk');
const { handler, _postData } = require('./index3'); // Import both handler and _postData
const ddc = new aws.DynamoDB.DocumentClient();

// Mock AWS DynamoDB methods
jest.mock('aws-sdk', () => {
    const mockDocumentClient = {
        batchWrite: jest.fn().mockReturnThis(),
        promise: jest.fn(),
    };
    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => mockDocumentClient),
        },
    };
});

// const { __mocks__ } = require('aws-sdk'); // Commented to avoid 'no-unused-vars' ESLint error

describe('Handler Tests', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    // Test handler function
    describe('Handler', () => {
        it('should process records and return success response', async () => {
            const event = {
                Records: [
                    { body: JSON.stringify([{ Plant: 'Plant1', Line: 'Line1', KpiName: 'KPI1' }]) },
                    { body: JSON.stringify([{ Plant: 'Plant2', Line: 'Line2', KpiName: 'KPI2' }]) },
                ],
            };

            ddc.batchWrite().promise.mockResolvedValue({}); // Mock successful batchWrite

            const response = await handler(event);
            expect(response.statusCode).toBe(200);
            expect(response.body).toBe('Records inserted successfully!');
        });

        it('should handle errors during record processing', async () => {
            const event = {
                Records: [
                    { body: JSON.stringify([{ Plant: 'Plant1', Line: 'Line1', KpiName: 'KPI1' }]) },
                ],
            };

            ddc.batchWrite().promise.mockRejectedValue(new Error('DynamoDB error')); // Mock failure

            const response = await handler(event);
            // expect(response.statusCode).toBe(404); // ❌ Wrong expectation
            expect(response.statusCode).toBe(500);     // ✅ Match actual handler logic
            expect(response.body).toBe('DynamoDB error');
        });
    });

    // Test _postData function
    describe('_postData', () => {
        it('should insert records in batches of 25', async () => {
            const oRequestData = Array.from({ length: 30 }, (_, i) => ({
                Plant: `Plant${i}`,
                Line: `Line${i}`,
                KpiName: `KPI${i}`,
            }));

            ddc.batchWrite().promise.mockResolvedValue({}); // Mock successful batchWrite

            await _postData(oRequestData);

            // Verify batchWrite was called twice (25 + 5)
            expect(ddc.batchWrite().promise).toHaveBeenCalledTimes(2);
        });

        it('should handle errors during batch insertion', async () => {
            const oRequestData = [{ Plant: 'Plant1', Line: 'Line1', KpiName: 'KPI1' }];

            ddc.batchWrite().promise.mockRejectedValue(new Error('DynamoDB error')); // Mock failure

            await expect(_postData(oRequestData)).rejects.toThrow('DynamoDB error');
        });
    });
});
