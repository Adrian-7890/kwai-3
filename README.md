# Kwai2 - Clon de Red Social de Video Corto

Este proyecto es una aplicación full-stack construida con React, Vite, Tailwind CSS y Firebase.

## Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 18 o superior)
- [npm](https://www.npmjs.com/)
- Una cuenta de [Firebase](https://console.firebase.google.com/)

## Configuración Local

1. **Clonar el proyecto:**
   Si exportaste a GitHub:
   ```bash
   git clone <url-del-repositorio>
   cd <nombre-del-proyecto>
   ```
   Si descargaste el ZIP, simplemente descomprímelo y abre la carpeta en VS Code.

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   - Copia el archivo `.env.example` y cámbiale el nombre a `.env`.
   - Rellena los valores con tus propias claves de API.
   - Para la `GEMINI_API_KEY`, ve a [Google AI Studio](https://aistudio.google.com/app/apikey).

4. **Configurar Firebase:**
   - Asegúrate de tener un proyecto en Firebase con **Firestore**, **Authentication** (Google Login habilitado) y **Storage**.
   - Copia las reglas de `firestore.rules` a tu consola de Firebase.

5. **Ejecutar en modo desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000`.

## Estructura del Proyecto

- `src/App.tsx`: Componente principal con la lógica del feed, chat y perfil.
- `src/firebase.ts`: Configuración e inicialización de los servicios de Firebase.
- `firestore.rules`: Reglas de seguridad para tu base de datos.
- `tailwind.config.js`: Configuración de estilos y temas.

## Tecnologías Utilizadas

- **Frontend:** React, Vite, Tailwind CSS, Lucide React (iconos), Motion (animaciones).
- **Backend:** Firebase (Firestore, Auth, Storage).
- **IA:** Google Gemini SDK para el asistente inteligente.
