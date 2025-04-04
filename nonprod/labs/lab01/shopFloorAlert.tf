locals {
  env           = "nonprod"                                      # Need to update prod or non-prod
  name_prefix   = "grp3"                                         # Your base name prefix
  env_suffix    = "-${local.env}"                                # Always suffix the env
  email_address = "xinwei.cheng.88@gmail.com"                    # ✅ Centralize email for reuse
}

## ✅ SES Verified Email Identities ##
resource "aws_ses_email_identity" "source_alert_email" {
  email = local.email_address
}

resource "aws_ses_email_identity" "delivery_alert_email" {
  email = local.email_address
}

## ✅ IAM Policy for Alert Lambda (Checkov compliant)
resource "aws_iam_policy" "shopFloorAlert_lambda_policy_lab1" {
  name        = "shopFloorAlert_lambda_policy_lab1${local.env_suffix}"
  path        = "/"
  description = "Policy to be attached to lambda"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "VisualEditor0",
        Effect = "Allow",
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams",
          "kms:Decrypt"
        ],
        Resource = [
          aws_dynamodb_table.shop_floor_alerts.arn,
          aws_kms_key.shop_floor_alerts_kms.arn,
          "arn:aws:logs:*:*:*",
          "arn:aws:ses:*:*:identity/${local.email_address}"   # ✅ Scoped to verified SES email
        ]
      }
    ]
  })
}

## ✅ Lambda Execution Role ##
resource "aws_iam_role" "shopFloorAlert_lambda_role_lab1" {
  name = "shopFloorAlert_lambda_role_lab1${local.env_suffix}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Effect = "Allow",
        Sid    = ""
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "shopFloorAlert_lambda_role_attach" {
  role       = aws_iam_role.shopFloorAlert_lambda_role_lab1.name
  policy_arn = aws_iam_policy.shopFloorAlert_lambda_policy_lab1.arn
}

## ✅ Lambda ZIP Archive ##
data "archive_file" "lambdaalert" {
  type        = "zip"
  source_file = "${path.module}/lambdaAlert/sendAlertEmail/index1.js"
  output_path = "sendAlertEmail.zip"
}

## ✅ DLQ for SendAlert Lambda ##
resource "aws_sqs_queue" "dlq" {
  name = "send_alert_email_dlq${local.env_suffix}"
}

## ✅ Lambda Function: Send Alert Email ##
resource "aws_lambda_function" "send_alert_email" {
  function_name = "SendAlertEmail${local.env_suffix}"
  role          = aws_iam_role.shopFloorAlert_lambda_role_lab1.arn
  runtime       = "nodejs16.x"
  filename      = "sendAlertEmail.zip"
  handler       = "index1.handler"
  timeout       = 15

  source_code_hash = data.archive_file.lambdaalert.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  reserved_concurrent_executions = 5 # ✅ Required by Checkov

  dead_letter_config {
    target_arn = aws_sqs_queue.dlq.arn # ✅ Required by Checkov
  }
}

## ✅ KMS Key for DynamoDB ##
resource "aws_kms_key" "shop_floor_alerts_kms" {
  description         = "KMS key for ${local.env} shop_floor_alerts DynamoDB table"
  enable_key_rotation = true
}

## ✅ DynamoDB Table with Encryption, PITR and Streams ##
resource "aws_dynamodb_table" "shop_floor_alerts" {
  name             = "shop_floor_alerts${local.env_suffix}"
  billing_mode     = "PROVISIONED"
  read_capacity    = 5
  write_capacity   = 5
  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
  hash_key         = "PK"
  range_key        = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.shop_floor_alerts_kms.arn
  }
}

## ✅ Delay to allow table readiness before trigger ##
resource "null_resource" "delay" {
  provisioner "local-exec" {
    command = "sleep 30"
  }
}

## ✅ Lambda Trigger from DynamoDB Stream ##
resource "aws_lambda_event_source_mapping" "trigger" {
  batch_size        = 100
  event_source_arn  = aws_dynamodb_table.shop_floor_alerts.stream_arn
  function_name     = aws_lambda_function.send_alert_email.arn
  starting_position = "LATEST"

  depends_on = [null_resource.delay]
}
