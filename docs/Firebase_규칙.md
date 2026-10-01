# Firebase 규칙 전체본

Realtime Database **규칙** 탭의 내용을 **전부 지우고** 아래를 통째로 붙여 넣은 뒤 **게시**를 누르면 돼요.
게임이 쓰는 모든 경로(레이드·결투·친구·세이브·우편·월드 보스·문의)가 다 들어 있어요.

- 관리자 계정 번호(UID)는 `8V7bN7HfeIRGHCsGu8aeAcJlUBq2`로 들어가 있어요. 관리자 계정을 바꾸면 이 값을 전부 바꿔요.
- `//`로 시작하는 줄은 설명(주석)이에요. Firebase 규칙 편집기는 주석을 허용하지만, **게시할 때 오류가 나면** 주석이 없는 `docs/firebase_database_rules.json` 내용을 대신 붙여 넣어요.
- 규칙을 바꿀 때는 이 문서와 `docs/firebase_database_rules.json`을 같이 고쳐요 (내용은 같고 주석만 다름).

## 붙여 넣을 규칙

```
{
  "rules": {
    // 레이드·결투 방 (방 코드 6자리) — 로그인한 사람은 읽기, 방장·팀원·빈자리에 들어오는 사람만 쓰기
    "raids": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() || data.child('host').val() === auth.uid || data.child('guest').val() === auth.uid || (!data.child('guest').exists() && newData.child('guest').val() === auth.uid))",
        ".validate": "$code.matches(/^[A-Z0-9]{6}$/)"
      }
    },
    // 레이드·결투 진행 중 행동 기록 — 그 방의 방장·팀원만 쓰기
    "raidActs": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null && root.child('raids').child($code).exists() && (root.child('raids').child($code).child('guest').val() === auth.uid || root.child('raids').child($code).child('host').val() === auth.uid)"
      }
    },
    // 방 입장 순서 잠금 (두 명이 동시에 들어오는 것 막기)
    "locks": {
      "$k": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    // 방에 접속해 있는지 표시 — 본인 칸만 쓰기
    "presence": {
      "$room": {
        ".read": "auth != null",
        "$uid": {
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    },
    // 플레이어 공개 정보 (이름·대표 정령 등) — 누구나 읽기, 본인만 쓰기
    "players": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid",
        "name": {
          ".validate": "newData.isString() && newData.val().length <= 20"
        }
      }
    },
    // 친구 코드 8자리 → 계정 번호 — 처음 한 번만 만들 수 있음
    "friendCodes": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null && !data.exists() && newData.val() === auth.uid",
        ".validate": "$code.matches(/^[A-Z0-9]{8}$/)"
      }
    },
    // 내 친구 목록 — 본인만
    "friends": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    // 친구 요청함 — 보낸 사람과 받는 사람만 쓰기
    "friendReqs": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$from": {
          ".write": "auth != null && (auth.uid === $from || auth.uid === $uid)"
        }
      }
    },
    // 레이드 초대·결투 신청함 — 보낸 사람과 받는 사람만 쓰기
    "invites": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$from": {
          ".write": "auth != null && (auth.uid === $from || auth.uid === $uid)"
        }
      }
    },
    // 서버 세이브 — 본인만 읽고 쓰기
    "saves": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    // 지금 이 계정으로 접속한 기기 (한 번에 한 기기)
    "sessions": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    // 우편함 — 관리자만 보냄
    "mail": {
      // 모든 플레이어 우편 — 누구나 읽기, 관리자만 쓰기
      "all": {
        ".read": "auth != null",
        "$id": {
          ".write": "auth != null && auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2'"
        }
      },
      // 개인 우편 — 본인·관리자만 읽기
      "user": {
        ".read": "auth != null && auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2'",
        "$uid": {
          ".read": "auth != null && auth.uid === $uid",
          "$id": {
            ".write": "auth != null && ((auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2' && (!data.child('c').exists() || !newData.exists())) || (auth.uid === $uid && !newData.exists()))",
            // 받은 시각 표시 — 받는 사람이 한 번만 적음 (받은 우편은 관리자도 수정 못 함, 삭제는 가능)
            "c": {
              ".write": "auth != null && auth.uid === $uid && !data.exists() && newData.isNumber() && data.parent().child('title').exists()"
            }
          }
        }
      }
    },
    // 월드 보스 (주마다) — 전체 체력 · 개인 기록 · 마지막 일격
    "worldboss": {
      "$week": {
        ".read": "auth != null",
        "total": {
          ".write": "auth != null",
          ".validate": "newData.isNumber()"
        },
        "p": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid"
          }
        },
        "killer": {
          ".write": "auth != null && !data.exists()"
        }
      }
    },
    // 문의함 — 관리자는 전체 읽기, 문의한 사람은 자기 것만
    "inquiries": {
      ".read": "auth != null && auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2'",
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2')",
        "$id": {
          ".write": "auth != null && (auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2' || (auth.uid === $uid && !data.exists()))",
          ".validate": "newData.hasChildren(['cat', 'text', 't'])",
          "cat": {
            ".validate": "newData.val() === 'bug' || newData.val() === 'idea' || newData.val() === 'etc'"
          },
          "text": {
            ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 500"
          },
          "t": {
            ".validate": "newData.isNumber()"
          },
          "name": {
            ".validate": "newData.isString() && newData.val().length <= 20"
          },
          "code": {
            ".validate": "newData.isString() && newData.val().length <= 12"
          },
          "ver": {
            ".validate": "newData.isNumber()"
          },
          // (예전 방식) 관리자 답장 한 개 — 지금은 msgs에 쌓음
          "reply": {
            ".validate": "auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2' && newData.isString() && newData.val().length <= 300"
          },
          // 관리자가 마지막으로 답한 시각 (빨간 점)
          "rt": {
            ".validate": "auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2' && newData.isNumber()"
          },
          // 문의한 사람이 마지막으로 이어 쓴 시각 (관리자 빨간 점)
          "ut": {
            ".write": "auth != null && auth.uid === $uid && data.parent().exists()",
            ".validate": "newData.isNumber()"
          },
          // (v3.0.1) 이어 쓰기 — 문의한 사람(a=false)과 관리자(a=true)가 번갈아 추가, 고치기 불가
          "msgs": {
            "$mid": {
              ".write": "auth != null && auth.uid === $uid && !data.exists() && data.parent().parent().exists()",
              ".validate": "newData.hasChildren(['m', 't', 'a']) && newData.child('a').isBoolean() && (auth.uid === '8V7bN7HfeIRGHCsGu8aeAcJlUBq2' || newData.child('a').val() === false)",
              "m": {
                ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 300"
              },
              "t": {
                ".validate": "newData.isNumber()"
              },
              "a": {
                ".validate": "newData.isBoolean()"
              },
              "$other": {
                ".validate": false
              }
            }
          },
          "$other": {
            ".validate": false
          }
        }
      }
    }
  }
}
```

## 최근 바뀐 것
- **v3.0.1** 문의 이어 쓰기: `inquiries/<uid>/<id>/msgs`, `ut` 추가 — 이걸 게시해야 문의를 여러 번 주고받을 수 있음
- **v2.10.5** 우편: 개인 우편 받은 표시 `c` · 관리자 개인 우편 읽기
