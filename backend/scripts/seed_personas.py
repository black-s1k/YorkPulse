"""
Seed persona accounts and initial Side Quests for YorkPulse.

Idempotent — safe to run multiple times. Skips any persona whose email
already exists in the database.

Usage:
    cd backend
    python scripts/seed_personas.py
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

# Allow running from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.buddy import BuddyCategory, BuddyRequest, BuddyRequestStatus, VibeLevel
from app.models.user import User


# ---------------------------------------------------------------------------
# Persona definitions
# ---------------------------------------------------------------------------
# Names are ethnically consistent — purely Indian or purely White/Western.
# No avatars (avatar_url=None) — letter-based UI fallback handles display.

NOW = datetime.now(timezone.utc)


def d(days: int, hour: int = 10, minute: int = 0) -> datetime:
    """Return an aware datetime N days from now at a given hour."""
    base = NOW.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return base + timedelta(days=days)


PERSONAS = [
    {
        "name": "Priya Nair",
        "email": "persona_priya_nair@internal.yorkpulse.com",
        "program": "Business Administration, Year 4",
        "bio": "Fourth-year BBA student. Loves chai and late submissions. Always down to grab food.",
        "quests": [
            {
                "category": BuddyCategory.FOOD,
                "activity": "Grabbing lunch at the Student Centre food court after my 12pm class, anyone want to join? Great way to take a break mid-week",
                "description": "Just a casual lunch run, nothing planned. Happy to chat about courses, co-op, life in general, anything really.",
                "location": "Student Centre Food Court",
                "start_time": d(2, hour=12, minute=30),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 3,
            },
            {
                "category": BuddyCategory.COMMUTE,
                "activity": "Heading to Keele TTC after my 5pm lecture every Tuesday. Anyone commuting toward Finch or Sheppard? Makes the ride less boring",
                "description": "Usually leave from Vari Hall around 5:10pm. Happy to chat or just exist in silence, no pressure.",
                "location": "Keele TTC Station",
                "start_time": d(5, hour=17, minute=10),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 2,
            },
        ],
    },
    {
        "name": "Arjun Sharma",
        "email": "persona_arjun_sharma@internal.yorkpulse.com",
        "program": "Computer Science, Year 2",
        "bio": "2nd year CS. Spend too much time on LeetCode and not enough sleeping. VSCode > everything.",
        "quests": [
            {
                "category": BuddyCategory.STUDY,
                "activity": "Pulling a study session at Scott Library tonight to catch up on EECS lectures, come suffer together. Floor 4 quiet zone",
                "description": "Mostly going over the first couple of lectures and the slides. Probably staying until 11pm. Bring snacks.",
                "location": "Scott Library, Floor 4",
                "start_time": d(1, hour=19, minute=0),
                "vibe_level": VibeLevel.INTERMEDIATE,
                "max_participants": 4,
            },
            {
                "category": BuddyCategory.GYM,
                "activity": "Early morning lift at Tait before 9am class, nothing intense, just upper body. Who else is trying to stay consistent this semester?",
                "description": "I usually hit chest/shoulders on Tuesdays. Casual pace, not trying to PR anything. Just staying active.",
                "location": "Tait McKenzie Centre",
                "start_time": d(3, hour=7, minute=30),
                "vibe_level": VibeLevel.INTERMEDIATE,
                "max_participants": 2,
            },
        ],
    },
    {
        "name": "Meera Iyer",
        "email": "persona_meera_iyer@internal.yorkpulse.com",
        "program": "Nursing, Year 3",
        "bio": "Nursing student surviving on coffee and clinical hours. Big fan of study groups and good playlists.",
        "quests": [
            {
                "category": BuddyCategory.STUDY,
                "activity": "Nursing study group, going over the first couple of lectures. Looking for 2 or 3 people who actually want to learn this stuff",
                "description": "I make summary sheets and quiz cards. Come prepared with your notes. Accolade West study rooms are usually quiet.",
                "location": "Accolade West Building, Study Room 102",
                "start_time": d(4, hour=14, minute=0),
                "vibe_level": VibeLevel.INTERMEDIATE,
                "max_participants": 4,
            },
            {
                "category": BuddyCategory.FOOD,
                "activity": "Coffee run to Founders Café between lectures, need a break from the library lol. Anyone want to come?",
                "description": "Just 30 to 40 mins. Good chance to actually touch grass and talk to a human being.",
                "location": "Founders College Café",
                "start_time": d(6, hour=11, minute=15),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 3,
            },
        ],
    },
    {
        "name": "Rahul Verma",
        "email": "persona_rahul_verma@internal.yorkpulse.com",
        "program": "Mechanical Engineering, Year 1",
        "bio": "First-year mech eng. Still figuring out how university works. Gym is my stress relief.",
        "quests": [
            {
                "category": BuddyCategory.GYM,
                "activity": "Looking for a gym buddy at Tait, going 3x a week, just started. Would be nice to have someone to go with so I actually show up",
                "description": "I'm still learning the equipment so I'm not super experienced. Just want someone to go with consistently. Evenings work best for me.",
                "location": "Tait McKenzie Centre",
                "start_time": d(2, hour=17, minute=0),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 2,
            },
            {
                "category": BuddyCategory.STUDY,
                "activity": "MATH 1300 study session, the first couple of lectures are already wrecking me. Anyone else struggling? Let's figure it out together",
                "description": "Going over the lecture notes so far. Scott Library or somewhere quiet. Bring your textbook.",
                "location": "Scott Library, Floor 3",
                "start_time": d(7, hour=13, minute=0),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 5,
            },
        ],
    },
    {
        "name": "Emily Carter",
        "email": "persona_emily_carter@internal.yorkpulse.com",
        "program": "Psychology, Year 3",
        "bio": "Third-year Psych major. Interested in cognitive bias and why people make terrible decisions (myself included).",
        "quests": [
            {
                "category": BuddyCategory.STUDY,
                "activity": "Weekly psych study group, we go through the lecture slides together. Low key, no stress, just prep together",
                "description": "We started this last year and it was really helpful. Open to anyone in PSYC courses. Vari Hall atrium has good tables.",
                "location": "Vari Hall Atrium",
                "start_time": d(3, hour=16, minute=0),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 5,
            },
            {
                "category": BuddyCategory.CUSTOM,
                "activity": "Anyone want to visit the art exhibit at the Koffler Gallery this weekend? Going Sunday afternoon, way more fun with company",
                "description": "It's free for York students. Always wanted to go but felt weird going alone. Very low-key, just wandering around and chatting.",
                "location": "Koffler Gallery, Accolade East",
                "custom_category": "arts",
                "start_time": d(9, hour=14, minute=0),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 3,
            },
        ],
    },
    {
        "name": "Jake Thompson",
        "email": "persona_jake_thompson@internal.yorkpulse.com",
        "program": "Kinesiology, Year 2",
        "bio": "Kin student and certified gym rat. I actually enjoy early mornings and that scares people.",
        "quests": [
            {
                "category": BuddyCategory.GYM,
                "activity": "Morning lift at Tait, 7:30am, hitting legs today. If you're trying to build a morning routine, come join. It gets easier after the first couple weeks I promise",
                "description": "I'm there Mon/Wed/Fri mornings. Super welcoming if you're new, I can show you the equipment. Bring water.",
                "location": "Tait McKenzie Centre",
                "start_time": d(1, hour=7, minute=30),
                "vibe_level": VibeLevel.HIGH_ENERGY,
                "max_participants": 3,
            },
            {
                "category": BuddyCategory.FOOD,
                "activity": "Post-workout smoothie run, heading to the juice bar near Tait after my lift. Anyone want to grab something and chill for a bit?",
                "description": "Usually done by 9am. Good way to recover and actually have a conversation instead of just staring at your phone.",
                "location": "Tait McKenzie Centre, main entrance",
                "start_time": d(8, hour=9, minute=0),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 3,
            },
        ],
    },
    {
        "name": "Sarah Mitchell",
        "email": "persona_sarah_mitchell@internal.yorkpulse.com",
        "program": "Film Production, Year 2",
        "bio": "Film student. Currently obsessed with 70s cinema and trying to make my first short film. Always looking for crew.",
        "quests": [
            {
                "category": BuddyCategory.GAME,
                "activity": "Movie night in the Accolade screening room, we got access Friday evening. Voting on what to watch, probably something from the 70s or 80s",
                "description": "Bring snacks. We'll take a vote on the film. Open to anyone, doesn't have to be a film student. Just appreciate good cinema.",
                "location": "Accolade East Building, Screening Room",
                "start_time": d(4, hour=19, minute=30),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 8,
            },
            {
                "category": BuddyCategory.FOOD,
                "activity": "Late lunch at Vari Hall after my 1pm critique, need to decompress. Anyone free around 3pm on Thursday?",
                "description": "Film critiques are stressful, food helps. Good conversation and venting welcome.",
                "location": "Vari Hall Atrium",
                "start_time": d(10, hour=15, minute=0),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 3,
            },
        ],
    },
    {
        "name": "Connor Walsh",
        "email": "persona_connor_walsh@internal.yorkpulse.com",
        "program": "Economics, Year 4",
        "bio": "4th year econ. Applying to grad school and regretting every life decision. Open to discussing markets and memes.",
        "quests": [
            {
                "category": BuddyCategory.COMMUTE,
                "activity": "Anyone commuting from Finch West area? I take the 36A bus to Keele station every morning around 8:30, would be nice to have someone to talk to",
                "description": "The commute is 25 min and I've been listening to the same podcast for 3 weeks. Open to literally any conversation.",
                "location": "Finch West / Keele Station",
                "start_time": d(1, hour=8, minute=30),
                "vibe_level": VibeLevel.CHILL,
                "max_participants": 2,
            },
            {
                "category": BuddyCategory.GAME,
                "activity": "Smash Bros session in the games room at Bethune, looking for people to play with Wednesday evening. All skill levels welcome",
                "description": "I have a switch and extra controllers. Usually play for 2 or 3 hours. We can do friendlies or tournament bracket, whatever people prefer.",
                "location": "Bethune College Common Room",
                "start_time": d(6, hour=18, minute=0),
                "vibe_level": VibeLevel.INTERMEDIATE,
                "max_participants": 6,
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------

async def seed_personas() -> None:
    print("Starting persona seed...\n")
    created = 0
    skipped = 0

    async with async_session_maker() as db:
        for p in PERSONAS:
            # Idempotency check
            existing = await db.execute(select(User).where(User.email == p["email"]))
            if existing.scalar_one_or_none():
                print(f"  SKIP  {p['name']} — already exists")
                skipped += 1
                continue

            # Create user
            user = User(
                id=uuid.uuid4(),
                email=p["email"],
                name=p["name"],
                program=p["program"],
                bio=p["bio"],
                avatar_url=None,
                email_verified=True,
                name_verified=True,
                is_active=True,
                is_banned=False,
                is_admin=False,
                is_founder=False,
                is_persona=True,
            )
            db.add(user)
            await db.flush()  # get user.id before creating quests

            # Create quests
            for q in p["quests"]:
                start_time = q["start_time"]
                # Make timezone-naive if DB expects UTC naive datetimes
                if start_time.tzinfo is not None:
                    start_time = start_time.replace(tzinfo=None)

                end_time = start_time + timedelta(hours=3)

                quest = BuddyRequest(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    category=q["category"],
                    custom_category=q.get("custom_category"),
                    activity=q["activity"],
                    description=q.get("description"),
                    start_time=start_time,
                    end_time=end_time,
                    location=q["location"],
                    latitude=None,
                    longitude=None,
                    vibe_level=q["vibe_level"],
                    custom_vibe_level=None,
                    max_participants=q["max_participants"],
                    requires_approval=True,
                    current_participants=1,
                    status=BuddyRequestStatus.OPEN,
                )
                db.add(quest)

            print(f"  CREATE {p['name']} — {len(p['quests'])} quest(s)")
            created += 1

        await db.commit()

    print(f"\nDone. Created: {created}  Skipped: {skipped}")


async def main() -> None:
    await seed_personas()


if __name__ == "__main__":
    asyncio.run(main())
