const aws = require('aws-sdk');

// Initialize AWS SES client
const ses = new aws.SES();

// Pre-defined email message template
const oParams = {
    Destination: {
        ToAddresses: [
            "xinwei.cheng.88@gmail.com" // ✅ Update/add verified SES recipients here
        ]
    },
    Message: {
        Body: {
            Text: {
                Charset: "UTF-8",
                Data: "" // This gets filled dynamically
            }
        },
        Subject: {
            Charset: "UTF-8",
            Data: "KPI Alert"
        }
    },
    Source: "xinwei.cheng.88@gmail.com" // ✅ This must be verified in SES
};

exports.handler = async (event) => {
    console.log("Incoming event:", JSON.stringify(event, null, 2)); // Helpful debug logging

    for (let item of event.Records) {
        // Skip DELETE operations
        if (item.eventName === 'REMOVE') continue;

        const image = item.dynamodb.NewImage;

        // ✅ Safely extract values using optional chaining and default values
        const plant = image?.Plant?.S || 'UnknownPlant';
        const line = image?.Line?.S || 'UnknownLine';
        const kpiName = image?.KpiName?.S || 'UnknownKPI';
        const actualValue = parseInt(image?.KpiValue?.N || '0');
        const thresholdValue = parseInt(image?.Threshold?.N || '0'); // ✅ Match DynamoDB attribute name

        // ✅ Only send email when KPI exceeds the threshold
        if (actualValue > thresholdValue) {
            try {
                const msgBody = `${kpiName} has exceeded the threshold (${thresholdValue}) by ${actualValue - thresholdValue} units in ${plant}, Line ${line}`;

                // Fill in the dynamic message
                oParams.Message.Body.Text.Data = msgBody;

                console.log("Sending email with message:", msgBody);
                await ses.sendEmail(oParams).promise();
            } catch (error) {
                console.error("❌ Failed to send email:", error);
                return error.message;
            }
        }
    }
};
