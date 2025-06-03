# License Plate Recognition App

## Project Overview

This application allows users to upload vehicle images for automatic license plate recognition. The core goal is to streamline the process of identifying and managing vehicle plates, particularly for warehouse inventory tracking at car dealerships

## Key Features

- Upload images containing vehicle license plates.
- Automatic plate number extraction using Plate Recognizer API.
- Preview uploaded images with detected plate numbers.
- Confirm or reject detected plates to manage matched and unmatched records.
- Plates and pictures will be stored in MongoDB for a short while. Once the user is done with their invenatory inspect it would create the report which could be sent to the manager.
- Redirect to a dashboard after processing for easy management.

## Technology Stack

- Frontend: Next.js (React framework)
- OCR & Plate Recognition: Plate Recognizer API (replacing Tesseract for improved accuracy)
- Image handling and resizing before recognition
- Environment variables managed securely with `.env` and Next.js conventions

## Future Goals

- Improve image preprocessing to enhance recognition success rate.
- Add user authentication and database storage for persistent plate data.
- Expand functionality for warehouse inventory integration and reporting.

## Getting Started

- Add your Plate Recognizer API key in `.env` file as `NEXT_PUBLIC_PLATE_TOKEN`
- Run the development server with `npm run dev` or `yarn dev`
- Upload images and test the plate recognition functionality.

---

This project is a student initiative aimed at exploring computer vision and web app integration for practical automotive use cases.
