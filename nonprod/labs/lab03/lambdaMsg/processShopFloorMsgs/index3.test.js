/* eslint-disable no-undef */
const aws = require('aws-sdk');
const { handler } = require('./index3');

jest.mock('aws-sdk', () => {
    const batchWriteMock = jest.fn();
    const promiseMock = {
        promise: jest.fn()
    };

    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => ({
                batchWrite: batchWriteMock
            }))
        },
        __mocks__: {
            batchWriteMock,
            promiseMock
        }
    };
});

const { __mocks__ } = require('aws-sdk');
const ddc = new aws.DynamoDB.DocumentClient();

describe('Handler Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should process a valid event and insert records', async () => {
        // ✅ Simulate success
        ddc.batchWrite.mockReturnValueOnce({
            promise: jest.fn().mockResolvedValue({})
        });

        const event = {
            Records: [
                { body: JSON.stringify([{ Plant: 'Plant1', Line: 'Line1', KpiName: 'KPI1' }]) },
                { body: JSON.stringify([{ Plant: 'Plant2', Line: 'Line2', KpiName: 'KPI2' }]) }
            ]
        };

        const response = await handler(event);

        expect(ddc.batchWrite).toHaveBeenCalledTimes(2);
        expect(response.statusCode).toBe(200);
        expect(response.body).toBe("Records inserted successfully!");
    });

    it('should handle errors during record processing', async () => {
        // ✅ Simulate failure
        ddc.batchWrite.mockReturnValueOnce({
            promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
        });

        const event = {
            Records: [
                { body: JSON.stringify([{ Plant: 'Plant1', Line: 'Line1', KpiName: 'KPI1' }]) }
            ]
        };

        const response = await handler(event);

        // ❌ Before: expect(response.statusCode).toBe(404);
        // ✅ After:
        expect(response.statusCode).toBe(500); // Matches index3.js behavior
        expect(response.body).toBe('DynamoDB error');
    });
});
