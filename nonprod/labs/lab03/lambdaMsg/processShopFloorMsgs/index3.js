// Load AWS SDK and initialize DynamoDB DocumentClient
const aws = require('aws-sdk');
const ddc = new aws.DynamoDB.DocumentClient();

// This must match your actual DynamoDB table name (with environment suffix)
const tableName = 'shop_floor_alerts-nonprod';

exports.handler = async (event) => {
    // Log the incoming event for debugging
    console.log("Received event:", JSON.stringify(event));

    try {
        // Loop through each record in the SQS batch
        for (let item of event.Records) {
            // ✅ FIX 1: Safely parse body and normalize to array
            const payload = JSON.parse(item.body);
            const dataArray = Array.isArray(payload) ? payload : [payload]; // Ensures _postData always gets an array
            await _postData(dataArray);
        }

        // Return success response
        return _responseHelper(200, "Records inserted successfully!");
    } catch (error) {
        // Log and return any error encountered
        console.error("Lambda error:", error);
        return _responseHelper(500, error.message);
    }
};

const _postData = async (oRequestData) => {
    try {
        let oData = [], count = 0;

        // Loop through all items in the input array
        for (let [idx, item] of oRequestData.entries()) {
            count++;

            // Prepare a PutRequest item for DynamoDB batch write
            oData.push({
                PutRequest: {
                    Item: {
                        ...item,
                        PK: `PLANT#${item.Plant}`, // Partition key
                        SK: `LINE#${item.Line}#KPI#${item.KpiName}`, // Sort key
                        Timestamp: new Date().toISOString() // ✅ FIX 2: Add timestamp field for traceability
                    }
                }
            });

            // DynamoDB batchWrite supports max 25 items at a time
            if (count === 25 || idx === oRequestData.length - 1) {
                // ✅ FIX 2: Add log for debugging what’s being written
                console.log("Writing batch to DynamoDB:", JSON.stringify(oData, null, 2));

                await ddc.batchWrite({
                    RequestItems: {
                        [tableName]: oData
                    }
                }).promise();

                // Reset batch data
                oData = [];
                count = 0;
            }
        }
    } catch (error) {
        // Log detailed error if batch write fails
        console.error("Batch write failed:", error);
        throw error;
    }
};

// Response builder for API Gateway (optional here, but helpful for consistency)
const _responseHelper = (statusCode, payload) => {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*"
        },
        body: payload
    };
};

// Exported for potential unit testing
module.exports = {
    handler: exports.handler,
    _postData,
};
