"""
Create CareDataCareJourney-dev DynamoDB table using boto3.
Uses same credentials/region as the backend (.env AWS_REGION).
Run from Back-End folder: python create-care-journey-table.py
"""
import os
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = "CareDataCareJourney-dev"
REGION = os.environ.get("AWS_REGION") or os.environ.get("COGNITO_REGION") or "ap-southeast-2"

def main():
    # Load .env if present
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

    region = os.environ.get("AWS_REGION") or os.environ.get("COGNITO_REGION") or "ap-southeast-2"
    print(f"Creating table {TABLE_NAME} in region {region}...")

    dynamodb = boto3.client("dynamodb", region_name=region)
    try:
        dynamodb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {"AttributeName": "sub", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "sub", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"  Created {TABLE_NAME}.")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"  Table {TABLE_NAME} already exists.")
        else:
            print(f"  Error: {e}")
            raise

if __name__ == "__main__":
    main()
