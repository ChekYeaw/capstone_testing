const aws = require('aws-sdk')
const ddc = new aws.DynamoDB.DocumentClient()
const tableName = 'shop_floor_alerts-nonprod'

exports.handler = async (event) => {
    console.log(event)

    const httpMethod = event.httpMethod
    switch (httpMethod) {
        case 'POST':
            try {
                await _postData(JSON.parse(event.body))
                return _responseHelper(200, "Records inserted successfully!")
            } catch (error) {
                return _responseHelper(404, error.message)
            }
        case 'GET':
            try {
                const plant = event.queryStringParameters['Plant']
                const line = event.queryStringParameters['Line']
                const response = await _getData(plant, line)
                return _responseHelper(200, JSON.stringify(response))
            } catch (error) {
                return _responseHelper(404, error.message)
            }
        case 'DELETE':
            try {
                const plant = event.queryStringParameters['Plant']
                const line = event.queryStringParameters['Line']
                const kpiName = event.queryStringParameters['KpiName']
                await _deleteItem(plant, line, kpiName)
                return _responseHelper(200, "Item deleted successfully!")
            } catch (error) {
                return _responseHelper(404, error.message)
            }

    }

}

const _postData = async (oRequestData) => {

    let oData = [], count = 0

    for (let [idx, item] of oRequestData.entries()) {
        count++
        oData.push({
            PutRequest: {
                Item: {
                    ...item,
                    PK: `PLANT#${item.Plant}`,
                    SK: `LINE#${item.Line}#KPI${item.KpiName}`
                }
            }
        })

        //Batch write rejects request with more than 25 request items
        if (count === 25 || (idx === (oRequestData.length - 1))) {
            try {
                await ddc.batchWrite({
                    RequestItems: {
                        [tableName]: oData //Dynamo DB table name
                    }
                }).promise()
                oData = []
                count = 0
            } catch (error) {
                throw new Error(error.message)
            }

        }
    }
}

const _getData = async (plant, line) => {
    const oParams = {
        Select: 'ALL_ATTRIBUTES',
        ExpressionAttributeNames: {
            '#PK': 'PK',
            '#SK': 'SK'
        }
    }
    oParams['TableName'] = tableName
    oParams['KeyConditionExpression'] = '#PK=:pk and begins_with(#SK,:sk)'
    oParams['ExpressionAttributeValues'] = {
        ':pk': `PLANT#${plant}`,
        ':sk': `LINE#${line}`
    }

    try {
        const response = await ddc.query(oParams).promise()
        return response
    } catch (error) {
        throw new Error(error.message)
    }
}

const _deleteItem = async (plant, line, kpi) => {
    const oParams = {
        TableName: tableName,
        Key: {
            'PK': `PLANT#${plant}`,
            'SK': `LINE#${line}#KPI${kpi}`,
        }
    }

    try {
        await ddc.delete(oParams).promise()
    } catch (error) {
        throw new Error(error.message)
    }
}

const _responseHelper = (statusCode, payload) => {
    return {
        "statusCode": statusCode,
        "headers": {
            "Access-Control-Allow-Origin": "*"
        },
        "body": payload
    }
}
