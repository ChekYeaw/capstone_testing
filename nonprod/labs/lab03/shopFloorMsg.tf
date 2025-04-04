locals {
    env           = "nonprod"                                      # Need to update prod or non-prod
    name_prefix   = "grp3" # your base name prefix
    env_suffix    = "-${local.env}"                                # always suffix the env
  }

## IoT Core & Policy ##

resource "aws_iot_thing" "shop_floor_simulator" {
  name = "shop_floor_simulator${local.env_suffix}"       #local.env_suffix added
}

resource "aws_iot_policy" "pubsub" {
  name = "PubSubToAnyTopic${local.env_suffix}"       #local.env_suffix added"

  # Terraform's "jsonencode" function converts a
  # Terraform expression result to valid JSON syntax.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "iot:*",
        ]
        Effect   = "Allow"
        Resource = "*"
      },
    ]
  })
}

## IoT Core Rule & SQS Queue ##

resource "aws_iam_policy" "iot_policy" {
  name = "iot_policy${local.env_suffix}"       #local.env_suffix added
  path = "/"

  # Terraform's "jsonencode" function converts a
  # Terraform expression result to valid JSON syntax.
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Sid" : "VisualEditor0",
        "Effect" : "Allow",
        "Action" : [
          "sqs:*"
        ],
        "Resource" : "*"
      }
    ]
  })
}

resource "aws_iam_role" "iot_role" {
  name = "iot_role${local.env_suffix}"       #local.env_suffix added

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "iot.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "iot_role_attach" {
  role       = aws_iam_role.iot_role.name
  policy_arn = aws_iam_policy.iot_policy.arn
}

resource "aws_sqs_queue" "shop_floor_data_queue" {
  name = "shop_floor_data_queue${local.env_suffix}"         #local.env_suffix added
  receive_wait_time_seconds = 20
}

resource "aws_iot_topic_rule" "push_to_sqs" {
  name = "push_to_sqs${replace(local.env_suffix, "-", "_")}"  #local.env_suffix added
  enabled     = true
  sql         = "SELECT * from '1001/+/ShopFloorData'"
  sql_version = "2016-03-23"

  sqs {
    queue_url  = aws_sqs_queue.shop_floor_data_queue.url
    role_arn   = aws_iam_role.iot_role.arn
    use_base64 = false
  }
}

## processShopFloorMsgs Lambda Execution Role ##

resource "aws_iam_policy" "lambda_policy" {
  name = "lambda_policy${local.env_suffix}"         #local.env_suffix added
  path = "/"

  # Terraform's "jsonencode" function converts a
  # Terraform expression result to valid JSON syntax.
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Sid" : "VisualEditor0",
        "Effect" : "Allow",
        "Action" : [
          "sqs:*",
          "logs:*",
          "dynamodb:*",
          "kms:Decrypt"             # ✅ Xinwei Add this line
        ],
        "Resource" : "*"
      }
    ]
  })
}
resource "aws_iam_role" "lambda_role" {
  name = "lambda_role${local.env_suffix}"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "lambda_role_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

## shopFloorData Lambda Fucntion ##

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/lambdaMsg/processShopFloorMsgs/index3.js"
  output_path = "processShopFloorMsgs.zip"
}

resource "aws_lambda_function" "processShopFloorMsgs" {
  function_name = "ProcessShopFloorMsgs${local.env_suffix}"                #local.env_suffix added
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs16.x"
  filename      = "processShopFloorMsgs.zip"
  handler       = "index3.handler"                                         # ✅ Xinwei change index.handler to index3.handler
  timeout       = "15"

  source_code_hash = data.archive_file.lambda.output_base64sha256
  
  # Enable X-Ray tracing
  tracing_config { # tschui added to solve the severity issue detected by Snyk
    mode = "Active"
  }

}

resource "aws_lambda_event_source_mapping" "triggerMsg" {
  batch_size        = 100
  maximum_batching_window_in_seconds = 1
  event_source_arn  = aws_sqs_queue.shop_floor_data_queue.arn
  function_name     = aws_lambda_function.processShopFloorMsgs.function_name
}
