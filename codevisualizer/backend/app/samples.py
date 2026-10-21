from typing import List
from .schemas import SampleSnippet

SAMPLE_SNIPPETS: List[SampleSnippet] = [
    SampleSnippet(
        id="fastapi_auth",
        title="FastAPI Auth & JWT Pipeline",
        language="python",
        category="Backend Architecture",
        description="User login flow with password hashing, database lookup, and JWT token issuance.",
        code='''from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel
import hashlib

app = FastAPI(title="Auth Service")

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

def verify_password(plain_password: str, hashed_password: str) -> bool:
    salt = "secure_salt"
    computed = hashlib.sha256((plain_password + salt).encode()).hexdigest()
    return computed == hashed_password

def db_get_user(username: str):
    # Simulated database lookup
    mock_db = {
        "alice": {"id": 101, "hash": hashlib.sha256(("secret123" + "secure_salt").encode()).hexdigest(), "role": "admin"}
    }
    return mock_db.get(username)

def generate_jwt_token(user_id: int, role: str) -> str:
    # Encodes cryptographic payload
    return f"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload_{user_id}_{role}.signature"

@app.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    user = db_get_user(credentials.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    is_valid = verify_password(credentials.password, user["hash"])
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = generate_jwt_token(user["id"], user["role"])
    return TokenResponse(access_token=token, token_type="bearer")
'''
    ),
    SampleSnippet(
        id="order_workflow",
        title="E-Commerce Order Processing",
        language="python",
        category="Microservice Workflow",
        description="End-to-end checkout with inventory validation, Stripe payment charge, and order dispatch.",
        code='''class InventoryService:
    def check_stock(self, product_id: str, quantity: int) -> bool:
        return True

    def reserve_items(self, product_id: str, quantity: int):
        print(f"Items reserved for product {product_id}")

class PaymentGateway:
    def charge_customer(self, customer_id: str, amount_cents: int) -> dict:
        return {"transaction_id": "tx_998877", "status": "succeeded"}

class NotificationService:
    def send_order_confirmation(self, email: str, order_id: str):
        print(f"Receipt sent to {email}")

class OrderProcessor:
    def __init__(self):
        self.inventory = InventoryService()
        self.payment = PaymentGateway()
        self.notifications = NotificationService()

    def process_order(self, order_data: dict) -> dict:
        # Step 1: Verify inventory
        available = self.inventory.check_stock(order_data["item_id"], order_data["qty"])
        if not available:
            return {"success": False, "error": "Out of stock"}

        # Step 2: Reserve inventory
        self.inventory.reserve_items(order_data["item_id"], order_data["qty"])

        # Step 3: Process payment transaction
        charge = self.payment.charge_customer(order_data["customer_id"], order_data["amount_cents"])
        if charge["status"] != "succeeded":
            return {"success": False, "error": "Payment declined"}

        # Step 4: Dispatch notification receipt
        order_id = f"ord_{charge['transaction_id']}"
        self.notifications.send_order_confirmation(order_data["customer_email"], order_id)

        return {"success": True, "order_id": order_id}
'''
    ),
    SampleSnippet(
        id="express_api",
        title="Express.js REST API with Middleware",
        language="javascript",
        category="Web Architecture",
        description="Express HTTP endpoints with rate limiting, auth token check, and database query.",
        code='''const express = require('express');
const app = express();

// Middleware: Authenticate Bearer Token
function authMiddleware(req, res, next) {
    const token = req.headers['authorization'];
    if (!token || !token.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized token missing' });
    }
    req.user = { id: 'usr_42', role: 'developer' };
    next();
}

// Database query helper
async function queryDatabase(queryStr, params) {
    return [{ id: 1, name: 'Project Alpha', status: 'active' }];
}

// Service layer: metrics logger
function logMetrics(endpoint, durationMs) {
    console.log(`[Metric] ${endpoint} took ${durationMs}ms`);
}

// REST Route: Get User Projects
app.get('/api/projects', authMiddleware, async (req, res) => {
    const start = Date.now();
    try {
        const results = await queryDatabase('SELECT * FROM projects WHERE owner_id = ?', [req.user.id]);
        logMetrics('/api/projects', Date.now() - start);
        return res.json({ success: true, data: results });
    } catch (err) {
        return res.status(500).json({ error: 'Database query failed' });
    }
});

// REST Route: Create New Project
app.post('/api/projects', authMiddleware, async (req, res) => {
    const { title, description } = req.body;
    const project = await queryDatabase('INSERT INTO projects (title) VALUES (?)', [title]);
    return res.status(201).json({ created: true, project });
});
'''
    ),
    SampleSnippet(
        id="react_data_fetcher",
        title="React State & Query Pipeline",
        language="javascript",
        category="Frontend Component",
        description="Component lifecycle with caching, async API hook, and conditional rendering.",
        code='''import React, { useState, useEffect } from 'react';

// Custom Hook for API caching
function useUserDashboard(userId) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchMetrics() {
            setLoading(true);
            try {
                const res = await fetch(`/api/users/${userId}/metrics`);
                const json = await res.json();
                setData(json);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        if (userId) {
            fetchMetrics();
        }
    }, [userId]);

    return { data, loading, error };
}

// Main Presentational Component
export default function UserDashboard({ userId }) {
    const { data, loading, error } = useUserDashboard(userId);

    if (loading) return <div className="spinner">Loading metrics...</div>;
    if (error) return <div className="error-alert">Error: {error}</div>;

    return (
        <section className="dashboard-grid">
            <header>User: {data.username}</header>
            <div className="card">Active Projects: {data.projectsCount}</div>
            <div className="card">API Requests: {data.totalRequests}</div>
        </section>
    );
}
'''
    ),
    SampleSnippet(
        id="binary_tree_dfs",
        title="Binary Tree Depth-First Search",
        language="python",
        category="Algorithms & Data Structures",
        description="Recursive tree node traversal with search conditional branches and path reconstruction.",
        code='''class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class TreeSolver:
    def __init__(self, root: TreeNode):
        self.root = root
        self.visited_nodes = []

    def validate_node(self, node: TreeNode) -> bool:
        return node is not None and isinstance(node.val, int)

    def search_target(self, node: TreeNode, target: int, path: list) -> bool:
        if not self.validate_node(node):
            return False

        path.append(node.val)
        self.visited_nodes.append(node.val)

        # Check target match
        if node.val == target:
            return True

        # Traverse left branch
        if self.search_target(node.left, target, path):
            return True

        # Traverse right branch
        if self.search_target(node.right, target, path):
            return True

        # Backtrack
        path.pop()
        return False
'''
    )
]
