
# Project Blueprint

## Overview

This document outlines the project, including the style, design, and features of the application.

## Current State

The project is a Flutter application with a basic UI and includes features for menstrual cycle tracking, an emergency dashboard, and data analysis.

## Visual Design Overhaul Plan

### 1. **Dependencies**
* Add `google_fonts` for typography.
* Add `provider` for theme management.

### 2. **Theme**
* Create a new `ThemeData` using `ColorScheme.fromSeed` with a modern color palette.
* Define a `TextTheme` using `google_fonts` for expressive typography.
* Implement both light and dark themes.
* Create a `ThemeProvider` to allow users to switch between themes.

### 3. **UI Refactoring**
* Update the main app structure to use the new theme and `ThemeProvider`.
* Refactor existing widgets to use the new `ThemeData` for a consistent look and feel.
* Apply modern UI patterns, such as cards with soft shadows, to improve the visual hierarchy.
