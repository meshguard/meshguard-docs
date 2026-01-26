---
title: Amazon Bedrock Agents
description: How to govern Amazon Bedrock agents and action groups with MeshGuard.
---

# Amazon Bedrock Agents

This guide explains how to integrate MeshGuard with Amazon Bedrock Agents to provide fine-grained governance, authorization, and audit for your AI-powered workflows. By wrapping Bedrock Action Groups with MeshGuard, you can enforce security policies on the specific actions your agents can perform.

## Overview

Amazon Bedrock Agents allow you to build applications that can execute multi-step tasks across company systems and data sources. While Bedrock offers Guardrails for content safety, MeshGuard provides a critical layer of **identity-aware access control**. This lets you define *who* can do *what*, manage delegation, and create a unified audit trail for all agent actions.

With MeshGuard, you can govern Bedrock agent actions like:
- Querying sensitive databases (e.g., customer PII, financial records).
- Triggering business workflows (e.g., issuing a refund, updating a CRM record).
- Accessing internal APIs and microservices.

## Installation

First, ensure you have the necessary Python libraries installed. You'll need the AWS SDK (`boto3`) to interact with Bedrock and the MeshGuard SDK.

```bash
pip install boto3 meshguard
```

## Quick Start

The core integration pattern involves wrapping the code inside your Bedrock Action Group's Lambda handler with a MeshGuard policy check.

Here’s a quick example of a Lambda handler for an action group that queries customer data.

```python
# lambda_function.py
import json
import os
from meshguard import MeshGuardClient

# Initialize MeshGuard client from environment variables
MG_GATEWAY_URL = os.environ.get("MESHGUARD_GATEWAY_URL", "https://dashboard.meshguard.app")
MG_AGENT_TOKEN = os.environ.get("MESHGUARD_AGENT_TOKEN")

meshguard_client = MeshGuardClient(gateway_url=MG_GATEWAY_URL, agent_token=MG_AGENT_TOKEN)

def query_customer_database(customer_id):
    """Placeholder function to query the database."""
    # In a real application, this would connect to your database
    print(f"Querying database for customer {customer_id}...")
    return {"customerId": customer_id, "name": "Jane Doe", "status": "active"}

def lambda_handler(event, context):
    """
    AWS Lambda handler for the Bedrock Agent action group.
    """
    action_group = event['actionGroup']
    function = event['function']
    parameters = {p['name']: p['value'] for p in event['requestBody']['content']['application/json']['properties']}

    # Extract user identity from session attributes
    session_attributes = event.get('sessionAttributes', {})
    user_id = session_attributes.get('userId', 'anonymous') # Default to anonymous if not present

    if function == 'query_customer_database':
        customer_id = parameters.get('customer_id')

        # Govern the action with MeshGuard
        check_result = meshguard_client.check(
            "db:query:customers",
            context={
                "user": user_id,
                "customer_id": customer_id,
                "source_agent": "bedrock-finance-agent"
            }
        )

        if not check_result.get('allow', False):
            # If not allowed, return a message indicating denial
            response_body = {
                'application/json': {
                    'body': f"Access denied by MeshGuard policy. Reason: {check_result.get('reason')}"
                }
            }
        else:
            # If allowed, execute the function
            result = query_customer_database(customer_id)
            response_body = {
                'application/json': {
                    'body': json.dumps(result)
                }
            }
    else:
        response_body = {
            'application/json': {
                'body': f"Unknown function: {function}"
            }
        }

    action_response = {
        'actionGroup': action_group,
        'function': function,
        'functionResponse': {
            'responseBody': response_body
        }
    }

    api_response = {'messageVersion': '1.0', 'response': action_response}
    return api_response

```

In this example:
1.  The Lambda handler receives an invocation from the Bedrock Agent.
2.  It extracts the `userId` from the agent's session attributes. This is crucial for identity-aware policies.
3.  Before calling `query_customer_database`, it calls `meshguard_client.check()`.
4.  The decision from MeshGuard (`allow` or `deny`) determines whether the database query proceeds.
5.  The outcome is sent back to the Bedrock Agent.

## Session Management and User Identity

To make effective policy decisions, MeshGuard needs to know *who* is invoking the agent. You should pass user identity information into the Bedrock session.

When you call the `InvokeAgent` API, use the `sessionState` to include custom attributes.

```python
# Invoking a Bedrock Agent with user context
import boto3

bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

response = bedrock_agent_runtime.invoke_agent(
    agentId='YOUR_AGENT_ID',
    agentAliasId='YOUR_AGENT_ALIAS_ID',
    sessionId='user-session-123',
    sessionState={
        'sessionAttributes': {
            'userId': 'finance-analyst-01',
            'userDepartment': 'finance'
        }
    },
    inputText='What is the status of customer C12345?'
)
```
Your Lambda function can then access `userId` and `userDepartment` from the `event['sessionAttributes']` dictionary and pass them to MeshGuard in the context object.

## Audit Trail Integration

Every `meshguard_client.check()` call automatically generates a detailed audit log in the MeshGuard dashboard. This log includes:
- The decision (allow/deny).
- The identity of the user and agent.
- The action being performed (`db:query:customers`).
- The full context object passed in the check.
- The policy that made the decision.

This creates a unified, cross-platform audit trail for all governed actions, which is essential for compliance and security monitoring.

## Configuration Reference

Your Lambda function for the action group requires the following environment variables.

| Variable | Description | Example |
|---|---|---|
| `MESHGUARD_GATEWAY_URL` | The URL of your MeshGuard Gateway instance. | `https://dashboard.meshguard.app` |
| `MESHGUARD_AGENT_TOKEN` | A valid agent token with permissions to evaluate policies. | `mg_agent_...` |

## Troubleshooting

**Problem: All requests are denied.**
- **Check your agent token:** Ensure the `MESHGUARD_AGENT_TOKEN` is valid and has not expired.
- **Check your policies:** Verify that a policy exists in MeshGuard that allows the action for the given context. Review the audit logs in the MeshGuard dashboard to see which policy is being evaluated.
- **Check Gateway URL:** Ensure `MESHGUARD_GATEWAY_URL` is correct and reachable from your Lambda function's VPC.

**Problem: `userId` is showing as 'anonymous'.**
- Ensure you are passing `sessionAttributes` with a `userId` field when you call the `InvokeAgent` API. Without this, MeshGuard cannot apply identity-based policies.

**Problem: Lambda function times out.**
- This could be a networking issue. Ensure your Lambda function has the correct VPC and security group settings to access both the MeshGuard Gateway and any other resources (like databases) it needs.
- If you are self-hosting the MeshGuard Gateway, check its logs for errors.
---
