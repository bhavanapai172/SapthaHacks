export interface SampleProjectFile {
  filePath: string;
  language: string;
  content: string;
}

export interface SampleProjectDefinition {
  key: string;
  name: string;
  description: string;
  primaryLanguage: string;
  focusAreas: string[];
  files: SampleProjectFile[];
}

export const SAMPLE_PROJECTS: SampleProjectDefinition[] = [
  {
    key: 'authgate-js',
    name: 'AuthGate Express Middleware',
    description:
      'JavaScript token validation and sliding-window rate limiter with subtle security, async, and boundary defects.',
    primaryLanguage: 'javascript',
    focusAreas: ['Security bypass', 'Off-by-one boundary', 'Invalid input handling'],
    files: [
      {
        filePath: 'src/rateLimiter.js',
        language: 'javascript',
        content: `// Sliding-window request rate limiter for API routes
function createRateLimiter(maxRequests, windowMs) {
  const buckets = new Map();

  function checkLimit(clientIp, nowMs) {
    if (!buckets.has(clientIp)) {
      buckets.set(clientIp, []);
    }
    const timestamps = buckets.get(clientIp);
    const cutoff = nowMs - windowMs;

    // Bug: uses <= instead of < and mutates array poorly when filtering
    const active = timestamps.filter((ts) => ts >= cutoff);

    // Bug: off-by-one allows maxRequests + 1 requests through
    if (active.length > maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    active.push(nowMs);
    buckets.set(clientIp, active);
    return {
      allowed: true,
      remaining: maxRequests - active.length,
    };
  }

  return { checkLimit };
}

function parseBearerToken(headerValue) {
  // Bug: crashes if headerValue is undefined or non-string; misses case-insensitive Bearer prefix
  const parts = headerValue.split(' ');
  if (parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
}

module.exports = { createRateLimiter, parseBearerToken };
`,
      },
      {
        filePath: 'src/tokenVerify.js',
        language: 'javascript',
        content: `// Lightweight signature verifier for internal service tokens
function verifySignature(expectedSig, providedSig) {
  if (!expectedSig || !providedSig) {
    return false;
  }
  // Bug: direct === comparison leaks timing differences on secret tokens
  // and accepts mismatched whitespace or type coercion if not validated
  return expectedSig == providedSig;
}

function extractClaims(payloadJson) {
  // Bug: unguarded JSON.parse crashes entire request handler on malformed input
  const claims = JSON.parse(payloadJson);
  if (claims.exp < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, claims };
}

module.exports = { verifySignature, extractClaims };
`,
      },
    ],
  },
  {
    key: 'pycalc-ledger',
    name: 'PyCalc Ledger Engine',
    description:
      'Python financial batch calculator containing division-by-zero, mutable default arguments, and precision drift bugs.',
    primaryLanguage: 'python',
    focusAreas: ['Division by zero', 'Mutable default argument', 'Negative amount edge cases'],
    files: [
      {
        filePath: 'ledger.py',
        language: 'python',
        content: `def calculate_average_payout(amounts):
    # Bug: raises ZeroDivisionError when amounts is empty
    total = 0.0
    for item in amounts:
        total += item
    return round(total / len(amounts), 2)


def append_audit_entry(entry, log=[]):
    # Bug: mutable default list is shared across all function calls
    log.append(entry)
    return log


def apply_discount(price, discount_percent):
    # Bug: does not guard against negative prices or discount > 100
    discounted = price - (price * discount_percent / 100)
    return discounted
`,
      },
      {
        filePath: 'validator.py',
        language: 'python',
        content: `def parse_transaction_line(line):
    parts = line.split(",")
    # Bug: crashes with IndexError if line has fewer than 3 columns
    tx_id = parts[0].strip()
    currency = parts[1].strip()
    amount = float(parts[2].strip())
    return {"id": tx_id, "currency": currency, "amount": amount}
`,
      },
    ],
  },
  {
    key: 'ringbuffer-cpp',
    name: 'RingBuffer C++ Allocator',
    description:
      'Fixed-capacity C++ circular queue with capacity overwrite, empty-pop underflow, and index wrapping defects.',
    primaryLanguage: 'cpp',
    focusAreas: ['Buffer overflow risk', 'Empty pop underflow', 'Null/zero capacity'],
    files: [
      {
        filePath: 'ring_buffer.h',
        language: 'cpp',
        content: `#ifndef RING_BUFFER_H
#define RING_BUFFER_H

#include <vector>
#include <stdexcept>

class RingBuffer {
public:
    explicit RingBuffer(size_t capacity);
    bool push(int value);
    int pop();
    size_t size() const;

private:
    std::vector<int> data_;
    size_t head_;
    size_t tail_;
    size_t count_;
    size_t capacity_;
};

#endif
`,
      },
      {
        filePath: 'ring_buffer.cpp',
        language: 'cpp',
        content: `#include "ring_buffer.h"

RingBuffer::RingBuffer(size_t capacity)
    : data_(capacity), head_(0), tail_(0), count_(0), capacity_(capacity) {
    // Bug: allows zero capacity which causes division-by-zero on modulo
}

bool RingBuffer::push(int value) {
    // Bug: uses > instead of >=, overwriting oldest element when full
    if (count_ > capacity_) {
        return false;
    }
    data_[tail_] = value;
    tail_ = (tail_ + 1) % capacity_;
    count_++;
    return true;
}

int RingBuffer::pop() {
    // Bug: no empty check; underflows count_ (size_t wraps to SIZE_MAX)
    int val = data_[head_];
    head_ = (head_ + 1) % capacity_;
    count_--;
    return val;
}

size_t RingBuffer::size() const {
    return count_;
}
`,
      },
    ],
  },
];
