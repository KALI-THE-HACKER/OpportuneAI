# Ansible Deployment Guide for OpportuneAI

This directory contains production-ready Ansible playbooks and configurations to provision and deploy the complete OpportuneAI containerized stack on any Ubuntu/Debian Linux host.

---

## Architecture Deployed

- **Docker Engine & Docker Compose Plugin**
- **Nginx Reverse Proxy**: Ingress handling all HTTP traffic, SSL termination, and caching. Port 80 (or custom configured port) is the **only** exposed port.
- **Frontend Container**: React 19 + TanStack Start SSR application running on Node 20.
- **Backend API Container**: FastAPI application with async database pooling.
- **RQ Workers**:
  - `ai-processing` worker (Gemini LLM extraction)
  - `resume-processing` worker (PDF parsing & candidate profiling)
- **Redis 7**: Persistent caching and RQ task broker.
- **Systemd Unit (`opportuneai.service`)**: Ensures the Docker Compose stack starts automatically on server boot.

---

## Quick Start

### 1. Prerequisites on Controller Machine

Install Ansible:
```bash
pip install ansible
```

### 2. Configure Inventory

Copy the example inventory and customize your target server IP and SSH key:
```bash
cp ansible/inventory.ini.example ansible/inventory.ini
```

Edit `ansible/inventory.ini`:
```ini
[opportuneai_servers]
prod-server-01 ansible_host=203.0.113.45 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/id_rsa
```

### 3. Customize Deployment Variables (Optional)

Edit `ansible/vars.yml.example` (or create `ansible/vars.yml`):
```yaml
app_name: opportuneai
deploy_dir: /opt/opportuneai
app_port: 80
run_migrations: true
```

### 4. Run the Deployment Playbook

From the project root:
```bash
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml
```

Or from within `ansible/`:
```bash
cd ansible
ansible-playbook playbook.yml
```

---

## Managing the Stack on the Server

Once deployed, the stack can be managed directly via `docker compose` or `systemctl`:

```bash
cd /opt/opportuneai

# View running containers
docker compose ps

# View live logs
docker compose logs -f

# Check worker logs
docker compose logs -f rq-worker-ai
docker compose logs -f rq-worker-resume

# Restart stack
docker compose restart

# Manage systemd service
sudo systemctl status opportuneai
sudo systemctl restart opportuneai
```
