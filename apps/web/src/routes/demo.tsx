import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Info,
  Loader2,
  Mail,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const sampleRows = [
  { id: 'set-01', title: 'Norse Mythology', cards: 42, mastery: 68 },
  { id: 'set-02', title: 'Old English Roots', cards: 120, mastery: 41 },
  { id: 'set-03', title: 'Latin Prefixes', cards: 65, mastery: 88 },
  { id: 'set-04', title: 'Anki Import Test', cards: 18, mastery: 12 },
];

export function DemoRoute() {
  const [sliderValue, setSliderValue] = useState<number[]>([65]);
  const [progressValue, setProgressValue] = useState(45);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-6 text-primary" />
            <h1 className="text-3xl font-semibold">Component library</h1>
          </div>
          <p className="text-muted-foreground">
            Kitchen-sink page for every shadcn primitive we use. Fire it up whenever the design
            tokens change to catch regressions in{' '}
            <code className="rounded bg-muted px-1 py-0.5">src/index.css</code> or{' '}
            <code className="rounded bg-muted px-1 py-0.5">src/lib/design-tokens/</code>.
          </p>
        </header>

        <Tabs defaultValue="buttons" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-5">
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="forms">Forms</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="overlays">Overlays</TabsTrigger>
          </TabsList>

          {/* ------ Buttons ------ */}
          <TabsContent value="buttons" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Button variants</CardTitle>
                <CardDescription>Six variants, four sizes, plus an icon-only size.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon" aria-label="Star">
                    <Star />
                  </Button>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-3">
                  <Button>
                    <Mail /> Login with email
                  </Button>
                  <Button variant="outline">
                    <Search /> Search sets
                  </Button>
                  <Button variant="destructive">
                    <Trash2 /> Delete set
                  </Button>
                  <Button disabled>
                    <Loader2 className="animate-spin" /> Signing in…
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge className="bg-mastery-mastered">Mastered</Badge>
                <Badge className="bg-mastery-learning text-neutral-900">Learning</Badge>
                <Badge className="bg-mastery-new text-neutral-900">New</Badge>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------ Forms ------ */}
          <TabsContent value="forms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Text inputs</CardTitle>
                <CardDescription>Input, Textarea, Label, Select.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="demo-email">Email</Label>
                  <Input id="demo-email" type="email" placeholder="you@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-lang">Preferred language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger id="demo-lang">
                      <SelectValue placeholder="Pick one" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Launch languages</SelectLabel>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="az">Azərbaycanca</SelectItem>
                        <SelectItem value="ru">Русский</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="demo-notes">Card notes</Label>
                  <Textarea id="demo-notes" placeholder="Private notes about this card…" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-disabled">Disabled</Label>
                  <Input id="demo-disabled" placeholder="Read only" disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-invalid">Invalid state</Label>
                  <Input
                    id="demo-invalid"
                    aria-invalid
                    className="border-destructive focus-visible:ring-destructive"
                    defaultValue="bad@input"
                  />
                  <p className="text-xs text-destructive">Enter a valid email address.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Toggles &amp; choices</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-3">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Checkbox</p>
                  <div className="flex items-center gap-2">
                    <Checkbox id="demo-check-1" defaultChecked />
                    <Label htmlFor="demo-check-1">Auto-play audio</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="demo-check-2" />
                    <Label htmlFor="demo-check-2">Shuffle cards</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="demo-check-3" disabled />
                    <Label htmlFor="demo-check-3" className="text-muted-foreground">
                      Disabled
                    </Label>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Switch</p>
                  <div className="flex items-center gap-2">
                    <Switch id="demo-switch-1" defaultChecked />
                    <Label htmlFor="demo-switch-1">Daily reminders</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="demo-switch-2" />
                    <Label htmlFor="demo-switch-2">SRS reminders</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="demo-switch-3" disabled />
                    <Label htmlFor="demo-switch-3" className="text-muted-foreground">
                      Disabled
                    </Label>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Radio</p>
                  <RadioGroup defaultValue="learn">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="mode-flash" value="flash" />
                      <Label htmlFor="mode-flash">Flashcards</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="mode-learn" value="learn" />
                      <Label htmlFor="mode-learn">Learn</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="mode-write" value="write" />
                      <Label htmlFor="mode-write">Write</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slider</CardTitle>
                <CardDescription>Value: {sliderValue[0]}</CardDescription>
              </CardHeader>
              <CardContent>
                <Slider
                  value={sliderValue}
                  onValueChange={setSliderValue}
                  max={100}
                  step={5}
                  className="max-w-md"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------ Feedback ------ */}
          <TabsContent value="feedback" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Info />
                  <AlertTitle>Heads up</AlertTitle>
                  <AlertDescription>
                    You can generate flashcards from any topic with AI — try <code>/discover</code>.
                  </AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>
                    Check your email and password, then try again.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
                <CardDescription>Mastery — {progressValue}%</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progressValue} />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProgressValue((v) => Math.max(0, v - 10))}
                  >
                    –10
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProgressValue((v) => Math.min(100, v + 10))}
                  >
                    +10
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skeletons</CardTitle>
                <CardDescription>Loading placeholders.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------ Data ------ */}
          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Avatars</CardTitle>
                <CardDescription>With fallback initials.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="https://i.pravatar.cc/80?img=12" alt="User" />
                  <AvatarFallback>SM</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>ED</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarImage src="broken-url" alt="User" />
                  <AvatarFallback>?</AvatarFallback>
                </Avatar>
                <Avatar className="size-16">
                  <AvatarFallback className="text-base">JR</AvatarFallback>
                </Avatar>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Table</CardTitle>
                <CardDescription>Recent study sets and their mastery.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableCaption>A list of your most recent study sets.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Set</TableHead>
                      <TableHead className="text-right">Cards</TableHead>
                      <TableHead className="w-[200px]">Mastery</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.title}</TableCell>
                        <TableCell className="text-right">{row.cards}</TableCell>
                        <TableCell>
                          <Progress value={row.mastery} />
                        </TableCell>
                        <TableCell className="text-right">
                          {row.mastery >= 80 ? (
                            <Badge className="bg-mastery-mastered">Mastered</Badge>
                          ) : row.mastery >= 30 ? (
                            <Badge className="bg-mastery-learning text-neutral-900">Learning</Badge>
                          ) : (
                            <Badge className="bg-mastery-new text-neutral-900">New</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------ Overlays ------ */}
          <TabsContent value="overlays" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Dialog</CardTitle>
                <CardDescription>Modal — traps focus, closes on Esc.</CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <BookOpen /> Open dialog
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete this set?</DialogTitle>
                      <DialogDescription>
                        This action can&apos;t be undone. The set and all its cards will be
                        permanently deleted.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button variant="destructive">
                        <Trash2 /> Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tooltip</CardTitle>
                <CardDescription>Hover the trigger, wait ~500 ms.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Info">
                      <Info />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>What this button does</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline">Hover me</Badge>
                  </TooltipTrigger>
                  <TooltipContent side="right">Tooltip on the right side</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card with footer</CardTitle>
                <CardDescription>
                  Cards are the primary layout container throughout the app.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Card content sits here. Use these to group related UI in the dashboard.
                </p>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button variant="ghost">Cancel</Button>
                <Button>Save changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
