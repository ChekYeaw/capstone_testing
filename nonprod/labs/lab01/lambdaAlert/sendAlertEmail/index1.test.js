/* eslint-disable no-undef */
const aws = require('aws-sdk');
const { handler } = require('./index1');

jest.mock('aws-sdk', () => {
    const sendEmailMock = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
    });

    return {
        SES: jest.fn(() => ({
            sendEmail: sendEmailMock
        }))
    };
});

describe('SES Email Sending', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should send an email when actual value exceeds threshold', async () => {
        const event = {
            Records: [
                {
                    eventName: 'INSERT',
                    dynamodb: {
                        NewImage: {
                            Plant: { S: 'Plant1' },
                            Line: { S: 'Line1' },
                            KpiValue: { N: '110' },
                            Threshold: { N: '100' }, // ✅ updated key
                            KpiName: { S: 'Production Rate' }
                        }
                    }
                }
            ]
        };

        await handler(event);

        expect(aws.SES().sendEmail).toHaveBeenCalled();
        expect(aws.SES().sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            Destination: {
                ToAddresses: ["xinwei.cheng.88@gmail.com"] // ✅ fixed recipient
            },
            Message: {
                Body: {
                    Text: {
                        Charset: "UTF-8",
                        Data: 'Production Rate has exceeded the threshold (100) by 10 units in Plant1, Line Line1' // ✅ fixed format
                    }
                },
                Subject: {
                    Charset: "UTF-8",
                    Data: "KPI Alert"
                }
            },
            Source: "xinwei.cheng.88@gmail.com" // ✅ fixed sender
        }));
    });

    it('should not send an email when actual value is within threshold', async () => {
        const event = {
            Records: [
                {
                    eventName: 'INSERT',
                    dynamodb: {
                        NewImage: {
                            Plant: { S: 'Plant1' },
                            Line: { S: 'Line1' },
                            KpiValue: { N: '90' },
                            Threshold: { N: '100' }, // ✅ updated key
                            KpiName: { S: 'Production Rate' }
                        }
                    }
                }
            ]
        };

        await handler(event);

        expect(aws.SES().sendEmail).not.toHaveBeenCalled();
    });

    it('should ignore REMOVE event', async () => {
        const event = {
            Records: [
                {
                    eventName: 'REMOVE',
                    dynamodb: {}
                }
            ]
        };

        await handler(event);

        expect(aws.SES().sendEmail).not.toHaveBeenCalled();
    });
});
