/* eslint-disable no-undef */
const aws = require('aws-sdk');
const { handler } = require('./index2'); // Import the handler function
const ddc = new aws.DynamoDB.DocumentClient();

// Mock AWS DynamoDB methods
jest.mock('aws-sdk', () => {
    const mockDocumentClient = {
        batchWrite: jest.fn().mockReturnThis(),
        query: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        promise: jest.fn(),
    };
    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => mockDocumentClient),
        },
    };
});

describe('Handler Tests', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    // Test POST method
    describe('POST Method', () => {
        it('should insert records successfully', async () => {
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify([
                    { Plant: 'Plant1', Line: 'Line1', KpiName: 'KPI1' },
                    { Plant: 'Plant2', Line: 'Line2', KpiName: 'KPI2' },
                ]),
            };

            ddc.batchWrite().promise.mockResolvedValue({}); // Mock successful batchWrite

            const response = await handler(event);
            expect(response.statusCode).toBe(200);
            expect(response.body).toBe('Records inserted successfully!');
        });

        it('should handle errors during record insertion', async () => {
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify([
                    { Plant: 'Plant1', Line: 'Line1', KpiName: 'KPI1' },
                ]),
            };

            ddc.batchWrite().promise.mockRejectedValue(new Error('DynamoDB error')); // Mock failure

            const response = await handler(event);
            expect(response.statusCode).toBe(404);
            expect(response.body).toBe('DynamoDB error');
        });
    });

    // Test GET method
    describe('GET Method', () => {
        it('should retrieve data successfully', async () => {
            const event = {
                httpMethod: 'GET',
                queryStringParameters: {
                    Plant: 'Plant1',
                    Line: 'Line1',
                },
            };

            const mockData = { Items: [{ Plant: 'Plant1', Line: 'Line1', KpiName: 'KPI1' }] };
            ddc.query().promise.mockResolvedValue(mockData); // Mock successful query

            const response = await handler(event);
            expect(response.statusCode).toBe(200);
            expect(response.body).toBe(JSON.stringify(mockData));
        });

        it('should handle errors during data retrieval', async () => {
            const event = {
                httpMethod: 'GET',
                queryStringParameters: {
                    Plant: 'Plant1',
                    Line: 'Line1',
                },
            };

            ddc.query().promise.mockRejectedValue(new Error('DynamoDB error')); // Mock failure

            const response = await handler(event);
            expect(response.statusCode).toBe(404);
            expect(response.body).toBe('DynamoDB error');
        });
    });

    // Test DELETE method
    describe('DELETE Method', () => {
        it('should delete an item successfully', async () => {
            const event = {
                httpMethod: 'DELETE',
                queryStringParameters: {
                    Plant: 'Plant1',
                    Line: 'Line1',
                    KpiName: 'KPI1',
                },
            };

            ddc.delete().promise.mockResolvedValue({}); // Mock successful delete

            const response = await handler(event);
            expect(response.statusCode).toBe(200);
            expect(response.body).toBe('Item deleted successfully!');
        });

        it('should handle errors during item deletion', async () => {
            const event = {
                httpMethod: 'DELETE',
                queryStringParameters: {
                    Plant: 'Plant1',
                    Line: 'Line1',
                    KpiName: 'KPI1',
                },
            };

            ddc.delete().promise.mockRejectedValue(new Error('DynamoDB error')); // Mock failure

            const response = await handler(event);
            expect(response.statusCode).toBe(404);
            expect(response.body).toBe('DynamoDB error');
        });
    });
});
