# WSL2 Local Dev Setup

This guide covers local Sven development on Windows using WSL2 Ubuntu.

## 1) Install WSL2 Ubuntu

Run in elevated PowerShell:

```powershell
wsl --install -d Ubuntu
```

Reboot when prompted, then open Ubuntu and create your Linux user.

## 2) Install Docker Engine inside WSL2

Inside Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Restart shell (`exit` then reopen). Verify:

```bash
docker ps
docker compose version
```

## 3) Optional NVIDIA CUDA in WSL2 (GPU inference)

Install latest NVIDIA Windows driver with WSL support, then inside Ubuntu:

```bash
nvidia-smi
```

For Docker GPU workloads:

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

## 4) Synology Mounts (NFS preferred, SMB fallback)

### NFS (preferred)

On Synology:
- Enable NFS.
- Create export rules for your WSL2 host IP/subnet.

Inside Ubuntu:

```bash
sudo apt-get install -y nfs-common
sudo mkdir -p /nas/shared /nas/users
sudo mount -t nfs -o nfsvers=4.1 <SYNOLOGY_IP>:/volume1/shared /nas/shared
sudo mount -t nfs -o nfsvers=4.1 <SYNOLOGY_IP>:/volume1/users /nas/users
```

Persist in `/etc/fstab` if desired.

### SMB (fallback)

```bash
sudo apt-get install -y cifs-utils
sudo mkdir -p /nas/shared
sudo mount -t cifs //<SYNOLOGY_IP>/shared /nas/shared -o username=<USER>,password=<PASS>,uid=$(id -u),gid=$(id -g),vers=3.0
```

