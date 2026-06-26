#!/bin/bash

# German Law Vault — Local AI Setup Assistant
# Automates the setup of local AI features for the German Law Vault app.

# Function to display a prompt and get user confirmation
get_user_confirmation() {
    local message="$1"
    read -p "$message (Y/n) " response
    if [[ "$response" =~ ^[Yy]$ || -z "$response" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to create a temporary directory
create_temp_directory() {
    local temp_dir="$1"
    if [ ! -d "$temp_dir" ]; then
        mkdir -p "$temp_dir"
        echo "Created temporary directory: $temp_dir"
    fi
}

# Function to install Ollama
install_ollama() {
    if ! command_exists ollama; then
        echo "Installing Ollama..."
        if command_exists curl; then
            curl -fsSL https://ollama.com/install.sh | sh
        elif command_exists wget; then
            wget -qO- https://ollama.com/install.sh | sh
        else
            echo "Error: Neither curl nor wget is available. Please install one of them."
            exit 1
        fi
        echo "Ollama installed successfully."
    else
        echo "Ollama is already installed."
    fi
}

# Function to download a model
download_model() {
    local model_name="$1"
    echo "Downloading model: $model_name..."
    if ! ollama pull "$model_name"; then
        echo "Failed to download model $model_name."
        exit 1
    fi
    echo "Model $model_name downloaded successfully."
}

# Function to start the broker
start_broker() {
    local broker_script="$1"
    echo "Starting local broker..."
    if ! python "$broker_script" &>/dev/null &; then
        echo "Failed to start broker."
        exit 1
    fi
    echo "Broker started successfully."
}

# Function to verify setup
verify_setup() {
    echo "Verifying setup..."
    if ! curl -s "http://localhost:9000/health" | grep -q '"status":"ok"'; then
        echo "Setup verification failed. Please check the broker logs."
        exit 1
    fi
    echo "Setup successful! Local AI is ready to use."
    echo "Broker URL: http://localhost:9000"
}

# Main script
echo "============================================="
echo "German Law Vault — Local AI Setup Assistant"
echo "============================================="
echo ""
echo "This assistant will help you set up the local AI features"
echo "of the German Law Vault app. Here's what will happen:"
echo ""
echo "1. Install Ollama (if not already installed)."
echo "2. Download a local AI model (~14GB for Qwen2.5:7B)."
echo "3. Start a local broker to connect the app to Ollama."
echo ""
echo "All files will be stored in: $HOME/.GermanLawVault"
echo ""
if get_user_confirmation "Do you want to proceed?"; then
    # Define paths
    temp_dir="$HOME/.GermanLawVault"
    broker_script="$temp_dir/broker.py"

    # Create temporary directory
    create_temp_directory "$temp_dir"

    # Copy broker script to temp directory
    if [ ! -f "$broker_script" ]; then
        echo "Copying broker script to $temp_dir..."
        cp broker.py "$broker_script" || {
            echo "Error: Failed to copy broker script."
            exit 1
        }
        echo "Copied broker script to $temp_dir"
    fi

    # Install Ollama
    install_ollama

    # Present model choices
    echo ""
    echo "Choose a local AI model:"
    echo "1. Qwen2.5:7B (Recommended for legal reasoning, ~14GB)"
    echo "2. Mistral-7B (Good for structured legal analysis, ~14GB)"
    echo "3. Phi-3:mini-4K (Lightweight, ~2.5GB)"
    echo ""
    read -p "Enter your choice (1-3): " choice

    model_map=(
        ["1"]="qwen2.5:7b"
        ["2"]="mistral:7b"
        ["3"]="phi3:mini-4k"
    )

    if [[ ! "${model_map[$choice]}" ]]; then
        echo "Invalid choice. Using default: Qwen2.5:7B"
        choice="1"
    fi

    # Check disk space
    free_space=$(df -k "$temp_dir" | awk 'NR==2 {print $4}')
    required_space=14000000  # 14GB in KB

    if [ "$choice" == "1" ] || [ "$choice" == "2" ]; then
        if [ "$free_space" -lt "$required_space" ]; then
            echo "Not enough disk space. Requires at least 14GB for Qwen2.5:7B or Mistral-7B."
            exit 1
        fi
    fi

    # Download model
    download_model "${model_map[$choice]}"

    # Start broker
    start_broker "$broker_script"

    # Verify setup
    verify_setup

    echo ""
    echo "Setup complete! You can now use the Local AI features in the app."
    echo ""
    echo "To stop the broker, run:"
    echo "  pkill -f 'python broker.py'"
    echo ""
else
    echo "Setup cancelled. No changes were made."
fi
