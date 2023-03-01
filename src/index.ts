import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

// ---------------- SERVER & MIDDLEWARE ---------------------

interface Client {
  id: number;
  response: express.Response;
}

const app = express();

const PORT = 3010;

const clients: Client[] = [];

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(PORT, () => {
  console.log(`Matches events service listening at http://localhost:${PORT}`);
});

// ------------------ EVENT HANDLER ---------------------

const eventsHandler = (
  request: express.Request,
  response: express.Response
) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  response.writeHead(200, headers);

  const data = `data: ${JSON.stringify(matches)}\n\n`;

  response.write(data);

  const clientId = Date.now();

  const newClient = {
    id: clientId,
    response
  };

  clients.push(newClient);

  request.on('close', () => {
    console.log(`${clientId} Connection closed`);
    clients.filter((client) => client.id !== clientId);
  });
};

const sendEventsToAll = (newResult: any) => {
  clients.forEach((client) =>
    client.response.write(`data: ${JSON.stringify(newResult)}\n\n`)
  );
};

app.get('/events', eventsHandler);

// ------------------ DB ---------------------

interface Team {
  teamName: string;
  goals: number;
}

interface Match {
  home: Team;
  away: Team;
}

const matches: Match[] = [
  {
    home: { teamName: 'Germany', goals: 0 },
    away: { teamName: 'Poland', goals: 0 }
  },
  {
    home: { teamName: 'Brazil', goals: 0 },
    away: { teamName: 'Mexico', goals: 0 }
  },
  {
    home: { teamName: 'Argentina', goals: 0 },
    away: { teamName: 'Uruguay', goals: 0 }
  }
];

// -------- UTILS ----------

const getRandomNumberOf = (max: number) => Math.round(Math.random() * max);

// --------------- MATCH ---------------------

let matchLoop: ReturnType<typeof setInterval>;

let appState: 'PRISTINE' | 'IN_PROGRESS' | 'FINISHED' = 'PRISTINE';

let goalCycle = 0;

const matchTick = () => {
  if (goalCycle < 9) {
    const shouldScoreRandomNumber = getRandomNumberOf(2);

    if (shouldScoreRandomNumber === 1) {
      const scoringMatch = getRandomNumberOf(2);
      const scoringSide = getRandomNumberOf(1);
      const scoringTeam =
        matches[scoringMatch][scoringSide === 0 ? 'home' : 'away'];

      scoringTeam.goals++;
    }

    goalCycle++;

    console.log('## GOAL CYCLE ==> ', goalCycle);
    console.log('## STANDINGS ==> ', matches);

    sendEventsToAll({ appState, matches });
  } else {
    clearInterval(matchLoop);
    sendEventsToAll({ appState: 'FINISHED', matches });
  }
};

const clearGoals = () =>
  matches.forEach((match) => {
    match.away.goals = 0;
    match.home.goals = 0;
  });

// ------------------ API ----------------------

app.get('/status', (request: express.Request, response: express.Response) =>
  response.json({ clients: clients.length })
);

const stopMatches = (request: express.Request, response: express.Response) => {
  clearInterval(matchLoop);
  appState = 'FINISHED';
  response.json({ status: appState });
};

const restartMatches = (
  request: express.Request,
  response: express.Response
) => {
  clearInterval(matchLoop);
  goalCycle = 0;
  clearGoals();
  matchLoop = setInterval(matchTick, 1000);
  appState = 'IN_PROGRESS';
  response.json({ status: appState });
};

app.post('/matches/start', restartMatches);
app.post('/matches/restart', restartMatches);
app.post('/matches/stop', stopMatches);

// curl -X POST -s http://localhost:3000/matches/start
// curl -X POST -s http://localhost:3000/matches/restart
// curl -X POST -s http://localhost:3000/matches/stop
