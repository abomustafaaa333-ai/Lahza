#!/bin/bash
# Keeps asking Oracle for the Always Free A1 VM until a slot is free, then tells
# the owner on WhatsApp. Installed on the old VM by `migrate-to-a1.sh hunt` and
# run by lahza-a1-hunt.service, so it keeps going after Cloud Shell is closed.
set -uo pipefail
. /etc/lahza-hunt.env   # COMP AD SUBNET IMAGE OCPUS MEM NOTIFY OLD_IP [SIZES]
# Sizes to try in turn, as "ocpus:gb" pairs. Smaller VMs fit into free slots more often;
# an older env file without SIZES keeps its single size.
read -ra sizes <<<"${SIZES:-$OCPUS:$MEM}"
export OCI_CLI_CONFIG_FILE=/root/.oci/config OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING=True
OCI=/opt/oci-cli/bin/oci
DONE=/opt/lahza/hunt.done
log() { echo "[$(date '+%F %T')] $*"; }
notify() {
  local key
  key=$(docker inspect waha --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n 's/^WAHA_API_KEY=//p')
  curl -s -m 20 -X POST http://localhost:3000/api/sendText -H "X-Api-Key: $key" -H 'Content-Type: application/json' \
    -d "{\"session\":\"default\",\"chatId\":\"$NOTIFY@c.us\",\"text\":\"$1\"}" >/dev/null || log "WhatsApp message not sent"
}
existing() {
  $OCI compute instance list -c "$COMP" --display-name lahza-a1 --all \
    --query 'data[?"lifecycle-state"!=`TERMINATED` && "lifecycle-state"!=`TERMINATING`] | [0].id' --raw-output 2>/dev/null
}

[ -f "$DONE" ] && { log "Already done: $(cat "$DONE")"; exit 0; }
if [ ! -f /opt/lahza/hunt.started ]; then
  touch /opt/lahza/hunt.started
  notify "لحظة: بدأ البحث التلقائي عن سيرفر Oracle المجاني A1. سأرسل لك رسالة هنا عندما يُنشأ."
fi

fds=(FAULT-DOMAIN-1 FAULT-DOMAIN-2 FAULT-DOMAIN-3)
attempt=0
while true; do
  # Every fault domain gets every size: the size changes each round of three attempts.
  attempt=$((attempt + 1)); fd=${fds[$((attempt % 3))]}; out=""
  size=${sizes[$(((attempt - 1) / 3 % ${#sizes[@]}))]}; OCPUS=${size%%:*}; MEM=${size##*:}
  id=$(existing)
  if [ -z "$id" ] || [ "$id" = null ]; then
    out=$($OCI compute instance launch --no-retry -c "$COMP" --availability-domain "$AD" --fault-domain "$fd" --subnet-id "$SUBNET" \
      --shape VM.Standard.A1.Flex --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEM}" \
      --image-id "$IMAGE" --assign-public-ip true --display-name lahza-a1 --boot-volume-size-in-gbs 50 \
      --ssh-authorized-keys-file /etc/lahza-hunt.pub --query 'data.id' --raw-output 2>&1)
    id=$(grep -o 'ocid1\.instance[^ "]*' <<<"$out" | tail -1)
    # An error reply can still hide a launch that went through.
    [ -n "$id" ] || { id=$(existing); [ "$id" = null ] && id=""; }
  fi
  if [ -n "$id" ]; then
    $OCI compute instance get --instance-id "$id" --wait-for-state RUNNING --max-wait-seconds 1200 >/dev/null 2>&1
    ip=$($OCI compute instance list-vnics --instance-id "$id" --query 'data[0]."public-ip"' --raw-output 2>/dev/null)
    # A VM found from an earlier attempt may have another size; report the one it really has.
    shape=$($OCI compute instance get --instance-id "$id" --query 'data."shape-config"' 2>/dev/null)
    OCPUS=$(grep -oE '"ocpus": [0-9.]+' <<<"$shape" | grep -oE '[0-9]+' | head -1 || echo "$OCPUS")
    MEM=$(grep -oE '"memory-in-gbs": [0-9.]+' <<<"$shape" | grep -oE '[0-9]+' | head -1 || echo "$MEM")
    echo "$id $ip ${OCPUS}ocpu ${MEM}gb" > "$DONE"
    log "GOT THE A1 VM: $ip ($id, $OCPUS OCPU / $MEM GB) after $attempt attempts"
    notify "لحظة ✅ تم إنشاء السيرفر المجاني A1 (IP: $ip، الحجم: $OCPUS OCPU و$MEM GB). افتح Cloud Shell وشغّل: bash m.sh create $OLD_IP $OCPUS $MEM"
    exit 0
  fi
  case "$out" in
    *LimitExceeded*|*QuotaExceeded*)
      log "STOP: the account's A1 limit is used up. $out"; notify "لحظة ⚠️ توقف البحث: حد سيرفرات A1 في الحساب مستخدم."; exit 0 ;;
    *NotAuthenticated*|*NotAuthorized*|*InvalidParameter*)
      log "STOP: Oracle rejected the request. $out"; notify "لحظة ⚠️ توقف البحث: Oracle رفض الطلب. راجع سجل البحث."; exit 0 ;;
    *TooManyRequests*|*'"status": 429'*)
      log "Attempt $attempt ($fd, $OCPUS/$MEM): too many requests, waiting 120s"; sleep 120 ;;
    *)
      log "Attempt $attempt ($fd, $OCPUS/$MEM): $(grep -m1 -oE '"message": "[^"]{0,90}' <<<"$out" || echo 'no free A1 slot'), waiting 60s"; sleep 60 ;;
  esac
done
