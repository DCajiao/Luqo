# 🧾 Luqo — Despliegue en Amazon EKS

**Computación en la Nube — Práctica 5**  
**Integrantes:** *[Natalia Moreno Montoya](https://github.com/natam226)*, *[David Cajiao Lazt](https://github.com/DCajiao)*, *[Valentina Bueno Collazos](https://github.com/valentinabc19)*

**Universidad Autónoma de Occidente**

---

## 📌 Caso de uso

**Luqo** es una aplicación de control inteligente de gastos que permite a los usuarios digitalizar facturas físicas mediante inteligencia artificial. Usando Google Document AI para extraer información de imágenes de facturas y Gemini para el análisis semántico, Luqo automatiza el registro de gastos y los presenta en un dashboard interactivo.

---

## 🏗️ Arquitectura de microservicios

```
Internet
    │
    ▼
┌─────────────────────┐
│   Load Balancer     │  ← AWS ELB (acceso público)
└─────────┬───────────┘
          │ :80
          ▼
┌─────────────────────┐
│     frontend        │  React + Vite + Nginx
│     (2 réplicas)    │
└─────────┬───────────┘
          │ :8000
          ▼
┌─────────────────────┐
│      backend        │  Node.js + Express
│     (2 réplicas)    │  Gemini · Document AI
└─────────┬───────────┘
          │ :3001
          ▼
┌─────────────────────┐
│     db-service      │  Node.js + Express
│     (2 réplicas)    │  API de acceso a BD
└─────────┬───────────┘
          │ :5432
          ▼
┌─────────────────────┐
│      database       │  PostgreSQL
│     (1 réplica)     │  Almacenamiento persistente
└─────────────────────┘
```

| Microservicio | Puerto | Tecnología | Rol |
|---|---|---|---|
| `frontend` | 80 | React + Vite + Nginx | Dashboard e interfaz de usuario |
| `backend` | 8000 | Node.js + Express | Lógica de negocio + IA (Gemini, Document AI) |
| `db-service` | 3001 | Node.js + Express | API de acceso a base de datos |
| `database` | 5432 | PostgreSQL | Almacenamiento persistente |

---

## 📁 Estructura del repositorio

```
Luqo/
├── microservices/
│   ├── frontend/         # App React + Vite + Nginx
│   ├── backend/          # API Node.js + lógica de IA
│   ├── db-service/       # API de acceso a PostgreSQL
│   └── database/         # Scripts SQL de inicialización
├── k8s/
│   ├── frontend-deployment.yaml
│   ├── backend-deployment.yaml
│   ├── db-service-deployment.yaml
│   ├── database-deployment.yaml
│   └── secrets.yaml
├── scripts/
│   ├── aws-credentials.sh
│   ├── create-ecr.sh
│   └── push-images.sh
├── docs/                 # Documentación adicional
├── docker-compose.yml    # Entorno de desarrollo local
├── .env.example          # Plantilla de variables de entorno
└── cluster.yaml          # Configuración del clúster EKS
```

---


### Herramientas a instalar

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# AWS CLI
sudo apt install unzip curl -y
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin/

# Verificar instalaciones
aws --version
kubectl version --client
eksctl version
docker --version
```

---

## 🚀 Paso a paso de despliegue

### 1. Clonar el repositorio

```bash
git clone https://github.com/DCajiao/Luqo.git
cd Luqo
```

Crear un archivo `.env` con las credenciales:

```env
JWT_SECRET=tu-clave-secreta
GCP_PROJECT_ID=tu-proyecto-gcp
GCP_LOCATION=us
DOCUMENT_AI_PROCESSOR_ID=tu-processor-id
GEMINI_API_KEY=tu-api-key
```
| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Clave secreta para firmar tokens JWT |
| `GCP_PROJECT_ID` | ID del proyecto en Google Cloud Platform |
| `GCP_LOCATION` | Región de GCP donde está el procesador (ej. `us`) |
| `DOCUMENT_AI_PROCESSOR_ID` | ID del procesador de Document AI |
| `GEMINI_API_KEY` | API key de Gemini |
---

### 2. Configurar credenciales de AWS Academy

Ejecuta el archivo aws-credentials.sh para ingresar las credenciales de AWS:

```bash
bash scripts/aws-credentials.sh
```

Ve al portal de AWS Academy → abre el laboratorio → clic en **AWS Details** → copia las credenciales e ingrésalas cuando el script las solicite.

> ⚠️ Las credenciales de AWS Academy expiran cada pocas horas. Renuévalas desde el portal cuando obtengas errores de autenticación.

---

### 3. Crear repositorios en Amazon ECR

```bash
bash scripts/create-ecr.sh
```

Este script crea los repositorios `luqo-frontend`, `luqo-backend`, `luqo-db-service` y `luqo-database` en ECR (región `us-east-1`).

---

### Paso 4 — Construir y subir imágenes a ECR

```bash
bash scripts/push-images.sh
```

---

### 5. Crear el clúster de Amazon EKS

Crea el archivo `cluster.yaml` reemplazando `<ACCOUNT_ID>`, `<LabEksClusterRole>` y `<LabEksNodeRole>` con los valores de tu cuenta (encuéntralos en **IAM → Roles** en la consola de AWS):

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: luqo-cluster
  region: us-east-1
  version: "1.35"

iam:
  serviceRoleARN: arn:aws:iam::<ACCOUNT_ID>:role/<LabEksClusterRole>

managedNodeGroups:
  - name: ng-1
    instanceType: t3.large
    desiredCapacity: 3
    minSize: 2
    maxSize: 4
    volumeSize: 20
    iam:
      instanceRoleARN: arn:aws:iam::<ACCOUNT_ID>:role/<LabEksNodeRole>
    tags:
      Project: luqo
      Environment: production

addons:
  - name: vpc-cni
    version: latest
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
```

> 💡 Para que funcionen todas las herramientas se recomienda usar **LabRole** como rol tanto para el clúster como para los nodos.

```bash
eksctl create cluster -f cluster.yaml --profile aws-academy
```

Conectar `kubectl` al clúster:

```bash
aws eks update-kubeconfig --region us-east-1 --name luqo-cluster --profile aws-academy
kubectl get nodes  # Deben aparecer 3 nodos en estado Ready
```

---

### 6. Crear namespace y secrets

```bash
kubectl create namespace luqo
```

Crea el archivo `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: luqo-secrets
  namespace: luqo
type: Opaque
stringData:
  JWT_SECRET: "tu-clave-secreta"
  GEMINI_API_KEY: "tu-api-key"
  GCP_PROJECT_ID: "tu-proyecto"
  DOCUMENT_AI_PROCESSOR_ID: "tu-processor-id"
  DATABASE_URL: "postgresql://luqo:luqo123@database-service:5432/luqo_db"
  POSTGRES_PASSWORD: "luqo123"
```

Si usas un archivo de credenciales JSON de GCP:

```bash
kubectl create secret generic gcp-credentials \
  --from-file=gcp-key.json=./credentials/gcp-key.json \
  -n luqo
```

---

### 7. Desplegar los microservicios

```bash
kubectl apply -f k8s/ -n luqo
```

Verifica que todos los pods estén en estado `Running`:

```bash
kubectl get pods -n luqo
```

Resultado esperado:

```
NAME                          READY   STATUS    RESTARTS   AGE
backend-xxx                   1/1     Running   0          2m
database-xxx                  1/1     Running   0          2m
db-service-xxx                1/1     Running   0          2m
frontend-xxx                  1/1     Running   0          2m
```

---

### 8. Obtener la URL pública

```bash
kubectl get service frontend-service -n luqo
```

La columna `EXTERNAL-IP` contiene la URL del balanceador de carga:

```
NAME               TYPE           CLUSTER-IP    EXTERNAL-IP                                    PORT(S)
frontend-service   LoadBalancer   10.100.x.x    xxxxx.us-east-1.elb.amazonaws.com              80:xxxxx/TCP
```

Abre esa URL en el navegador para acceder a Luqo. 

---

## 📁 Estructura de manifiestos Kubernetes

```
k8s/
├── database-deployment.yaml    # PostgreSQL: Deployment + ClusterIP Service
├── db-service-deployment.yaml  # DB Service: Deployment (2 réplicas) + ClusterIP Service
├── backend-deployment.yaml     # Backend IA: Deployment (2 réplicas) + ClusterIP Service
├── frontend-deployment.yaml    # Frontend: Deployment (2 réplicas) + LoadBalancer Service
└── secrets.yaml                # Secrets con credenciales
```

---
