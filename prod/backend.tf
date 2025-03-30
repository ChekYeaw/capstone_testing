terraform {
  backend "s3" {
    bucket = "sctp-ce8-tfstate"
    region = "ap-southeast-1"
    key    = "yyf_prod.tfstate" # must be different from other projects
  }
}
